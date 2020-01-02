import { Plugin } from '@midgar/midgar'

export const SCHEMA_DIR_KEY = 'midgar-migrate-schemas'
export const DATA_DIR_KEY = 'midgar-migrate-data'

/**
 * MigratePlugin plugin
 */
class MigratePlugin extends Plugin {
  constructor (...args) {
    super(...args)

    /**
     * Schema dir key
     * @type {String}
     */
    this.schemaDirKey = SCHEMA_DIR_KEY

    /**
     * Data dir key
     * @type {String}
     */
    this.dataDirKey = DATA_DIR_KEY
  }

  /**
   * Init plugin
   * Add schama et data plugin directories
   */
  init () {
    this.pm.addPluginDir(this.schemaDirKey, 'migrations/schemas')
    this.pm.addPluginDir(this.dataDirKey, 'migrations/data')
  }
}

export default MigratePlugin
