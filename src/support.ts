import * as deps from './scripts/deps'
import * as config from './config'
import logger from './logger'
import * as scriptLoader from './scripts/loader'
import { Script } from './scripts/shared'
import * as serverScripts from './scripts/server'
import * as clientScripts from './scripts/client'
import watch from 'node-watch'
import { debounce } from 'lodash'
import * as bundle from './bundler/webpack'

interface WatchFn {
    (): void;
}

const watcherOpts = {
  persistent: false,
  recursive: true,
  delay: 200,
  filter: /\.js$/,
}

interface WatcherConfig {
  basedir: string;
  enabled: boolean;
  watch: boolean;
}

export async function InstallDependencies (): Promise<deps.PackageInstallStatus[]> {
  if (!config.scripts.dependencies.autoUpdate) {
    return
  }

  logger.info('installing dependencies from %s', config.scripts.dependencies.packageJSON)
  return deps.Install(logger, config.scripts.dependencies)
}

export async function ReloadServerScripts (svc: serverScripts.Service): Promise<void> {
  if (!config.scripts.server.enabled) {
    return
  }

  // Reload scripts every-time packages changes!
  logger.info('reloading server scripts')
  return scriptLoader.ServerScriptReloader(config.scripts.server.basedir)
    .then((scripts: Script[]) => {
      const isValid = (s: Script): boolean => !!s.name && !!s.exec && s.errors.length === 0
      const vScripts = scripts.filter(isValid)

      // Log errors on all invalid scripts
      scripts
        .filter(s => !isValid(s))
        .forEach(({ filepath, name, errors }) => {
          errors.forEach(error => {
            logger.warn({ filepath, scriptName: name }, 'server script error: %s', error)
          })
        })

      // Let developer know about valid scripts loaded
      vScripts
        .forEach(
          ({ name, triggers }) =>
            logger.debug({ scriptName: name, triggers: triggers.length }, 'server script ready'))

      // All scripts (even invalid ones) are given to server scripts service
      // we might want to look at errors
      svc.Update(scripts)

      // Summarize reloading stats
      logger.info('%d valid server scripts loaded (%d total)',
        vScripts.length,
        scripts.length,
      )
    })
}

export async function ReloadAndBundleClientScripts (svc: clientScripts.Service): Promise<void> {
  if (!config.scripts.client.enabled) {
    return
  }

  logger.info('reloading client scripts')
  return scriptLoader.ClientScriptReloader(config.scripts.client.basedir)
    .then((scripts: Script[]) => {
      const isValid = (s: Script): boolean => !!s.name && !!s.exec && s.errors.length === 0
      const vScripts = scripts.filter(isValid)

      // Make bundles out of all valid scripts
      const scriptListPerBundle = vScripts.reduce((bi, s) => {
        // Split remaning path of the script
        const { bundle } = s

        if (!bi[bundle]) {
          bi[bundle] = []
        }

        bi[bundle].push(s)

        return bi
      }, {} as { [bundle: string]: Script[] })

      const bootloaderPerBundle = bundle.BootLoader(config.scripts.client.bundleOutputPath, scriptListPerBundle)
      for (const b in bootloaderPerBundle) {
        logger.debug({ bundle: b }, 'bundling client scripts')
        bundle.Pack(b, bootloaderPerBundle[b], config.scripts.client.basedir, config.scripts.client.bundleOutputPath)
      }

      // Log errors on all invalid scripts
      scripts
        .filter(s => !isValid(s))
        .forEach(({ filepath, name, errors }) => {
          errors.forEach(error => {
            logger.warn({ filepath, scriptName: name }, 'client script error: %s', error)
          })
        })

      // Let developer know about valid scripts loaded
      vScripts
        .forEach(
          ({ name, triggers }) =>
            logger.debug({ scriptName: name, triggers: triggers.length }, 'client script ready'))

      // All scripts (even invalid ones) are given to client scripts service
      // we might want to look at errors
      svc.Update(scripts)

      // Summarize reloading stats
      logger.info('%d valid client scripts loaded (%d total)',
        vScripts.length,
        scripts.length,
      )
    })
}

export function Watcher (callback: WatchFn, cfg: WatcherConfig, opts = watcherOpts): void {
  if (!cfg.enabled || !cfg.watch) {
    return
  }

  const watcher = watch(cfg.basedir, opts, debounce(() => callback(), 500))
  process.on('SIGINT', watcher.close)
}
