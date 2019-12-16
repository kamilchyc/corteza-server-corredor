// @ts-ignore
import ComposeApiClient from 'corteza-webapp-common/src/lib/corteza-server/rest-api-client/compose'
// @ts-ignore
import MessagingApiClient from 'corteza-webapp-common/src/lib/corteza-server/rest-api-client/messaging'
// @ts-ignore
import SystemApiClient from 'corteza-webapp-common/src/lib/corteza-server/rest-api-client/system'
// @ts-ignore
import ComposeHelper from 'corteza-webapp-common/src/lib/automation-scripts/context/compose'
// @ts-ignore
import MessagingHelper from 'corteza-webapp-common/src/lib/automation-scripts/context/messaging'
// @ts-ignore
import SystemHelper from 'corteza-webapp-common/src/lib/automation-scripts/context/system'
// @ts-ignore
import User from 'corteza-webapp-common/src/lib/types/system/user'

import {Logger} from "./logger";
import {ExecArgs} from "./exec-args";
import {IExecConfig} from "./d";

export interface IExecContextCtor {
    args:   ExecArgs,
    log:    Logger,
    config: IExecConfig,
}



/**
 * Handles script execution context
 *
 *
 */
export class ExecContext {
    readonly args:   ExecArgs;
    readonly config: IExecConfig;
    private  log:    Logger;

    /**
     * @param {IExecContextCtor} ctx
     * @param {IExecConfig} ctx.config
     * @param {ExecArgs} ctx.args
     * @param {Logger} ctx.log
     */
    constructor ({ config, args, log } : IExecContextCtor) {
        this.args = args;
        this.log = log;
        this.config = config;
    }

    /**
     * Returns promise with the current user (if jwt argument was given)
     *
     * @returns {Promise<User>}
     */
    get $authUser () : Promise<User> {
        return this.SystemAPI
            .authCheck()
            .then(({ user } : { user: User }) => user)
    }

    /**
     * Configures and returns system API client
     *
     * @returns {Promise<SystemApiClient>}
     */
    get SystemAPI () : SystemApiClient {
        const { baseURL } = this.config.server.system;
        const { jwt     } = this.args;

        return new SystemApiClient({ baseURL, jwt })
    }

    /**
     * Configures and returns compose API client
     *
     * @returns {Promise<ComposeApiClient>}
     */
    get ComposeAPI () : ComposeApiClient {
        const { baseURL } = this.config.server.compose;
        const { jwt     } = this.args;

        return new ComposeApiClient({ baseURL, jwt })
    }

    /**
     * Configures and returns messaging API client
     *
     * @returns {Promise<MessagingApiClient>}
     */
    get MessagingAPI () : MessagingApiClient {
        const { baseURL } = this.config.server.messaging;
        const { jwt     } = this.args;

        return new MessagingApiClient({ baseURL, jwt })
    }

    /**
     * Configures and returns system helper
     *
     * @returns {SystemHelper}
     */
    get System () : SystemHelper {
        return new SystemHelper({
            SystemAPI:    this.SystemAPI,
            $user:        this.args.$user,
            $role:        this.args.$role,
        })
    }

    /**
     * Configures and returns compose helper
     *
     * @returns {ComposeHelper}
     */
    get Compose () : ComposeHelper {
        return new ComposeHelper({
            ComposeAPI: this.ComposeAPI,
            $namespace: this.args.$namespace,
            $module:    this.args.$module,
            $record:    this.args.$record,
        })
    }

    /**
     * Configures and returns messaging helper
     *
     * @returns {MessagingHelper}
     */
    get Messaging () : MessagingHelper {
        return new MessagingHelper({
            MessagingAPI: this.MessagingAPI,
            $authUser:    this.$authUser,
            channel:      this.args.$channel,
        })
    }
}
