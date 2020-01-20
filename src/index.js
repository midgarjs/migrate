import { Plugin } from '@midgar/midgar'

export const SCHEMA_MODULE_TYPE_KEY = 'midgar-migrate-schema'
export const DATA_MODULE_TYPE_KEY = 'midgar-migrate-data'

/**
 * MigratePlugin class
 */
class MigratePlugin extends Plugin {
  constructor (...args) {
    super(...args)

    /**
     * Schema module type key
     * @type {string}
     */
    this.schemaModuleTypeKey = SCHEMA_MODULE_TYPE_KEY

    /**
     * Data module type key
     * @type {string}
     */
    this.dataModuleTypeKey = DATA_MODULE_TYPE_KEY
  }

  /**
   * Init plugin
   * Add schama et data module types
   */
  init () {
    this.pm.addModuleType(this.schemaModuleTypeKey, 'migrations/schemas', '**/+([0-9]).+([0-9]).+([0-9])-*.js')
    this.pm.addModuleType(this.dataModuleTypeKey, 'migrations/data', '**/+([0-9]).+([0-9]).+([0-9])-*.js')
  }
}

export default MigratePlugin
