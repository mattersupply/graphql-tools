'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const urlLoader = require('@graphql-tools/url-loader');
const prismaYml = require('prisma-yml');
const path = require('path');
const fsExtra = require('fs-extra');
const os = require('os');
const process = require('process');

class PrismaLoader extends urlLoader.UrlLoader {
    loaderId() {
        return 'prisma';
    }
    async canLoad(prismaConfigFilePath, options) {
        if (typeof prismaConfigFilePath === 'string' && prismaConfigFilePath.endsWith('prisma.yml')) {
            const joinedYmlPath = path.join(options.cwd || process.cwd(), prismaConfigFilePath);
            return new Promise(resolve => fsExtra.exists(joinedYmlPath, resolve));
        }
        return false;
    }
    async load(prismaConfigFilePath, options) {
        const { graceful, envVars = {} } = options;
        const home = os.homedir();
        const env = new prismaYml.Environment(home);
        await env.load();
        const joinedYmlPath = path.join(options.cwd || process.cwd(), prismaConfigFilePath);
        const definition = new prismaYml.PrismaDefinitionClass(env, joinedYmlPath, envVars);
        await definition.load({}, undefined, graceful);
        const serviceName = definition.service;
        const stage = definition.stage;
        const clusterName = definition.cluster;
        if (!clusterName) {
            throw new Error(`No cluster set. Please set the "cluster" property in your prisma.yml`);
        }
        const cluster = await definition.getCluster();
        if (!cluster) {
            throw new Error(`Cluster ${clusterName} provided in prisma.yml could not be found in global ~/.prisma/config.yml.
      Please check in ~/.prisma/config.yml, if the cluster exists.
      You can use \`docker-compose up -d\` to start a new cluster.`);
        }
        const token = definition.getToken(serviceName, stage);
        const url = cluster.getApiEndpoint(serviceName, stage, definition.getWorkspace() || undefined);
        const headers = token
            ? {
                Authorization: `Bearer ${token}`,
            }
            : undefined;
        return super.load(url, { headers });
    }
}

exports.PrismaLoader = PrismaLoader;
//# sourceMappingURL=index.cjs.js.map
