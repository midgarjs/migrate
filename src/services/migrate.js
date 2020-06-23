
import semver from 'semver'
import { assignRecursive, timer } from '@midgar/utils'

/**
 * @typedef {Object} Migration
 * @property {string} plugin Plugin name
 * @property {string} name   Migration file name
 * @property {string} type   Migration type (schema|data)
 */

/**
 * @typedef {Object} MigrationModule
 * @property {function} up   Up function
 * @property {function} down Down function
 */

/**
 * @typedef {Object} ExecutedMigration
 * @property {sring}  plugin Plugin name
 * @property {sring}  type   Migration type (schema|data)
 * @property {sring}  path   Migration file path
 * @property {number} time   exec time in ms
 */

/**
 * Service name
 * @type {string}
 */
const serviceName = 'mid:migrate'

/**
 * MidgarService class
 */
class MigrateService {
  /**
   * Constructor
   *
   * @param {Midgar} mid Midgar instance
   */
  constructor (mid) {
    /**
     * Plugin config
     * @var {Midgar}}
     */
    this.mid = mid

    /**
     * Plugin config
     * @var {object}
     */
    this.config = assignRecursive({}, this.mid.config.migrate || {}, {})

    /**
      * Migrate plugin instance
      * @var {MigratePlugin}
      */
    this.plugin = this.mid.pm.getPlugin('@midgar/migrate')

    /**
     * Storages
     * @var {object}
     */
    this.storages = {}

    /**
     * Storage instances
     * @var {object}
     * @private
     */
    this._storageInstances = {}

    /**
     * Migration file regex
     * @type: {RegExp}
     * @private
     */
    this._fileNameRegExp = /^((?:[\d]+\.?){3})-.*\.js$/
  }

  /**
   * Init service
   * Let other plugin add storage
   *
   * @return {Promise<void>}
   */
  async init () {
    this.mid.debug('@midgar/migrate: init.')
    /**
     * init event.
     * @event @midgar/migrate:init
     */
    await this.mid.emit('@midgar/migrate:init', this)
  }

  /**
   * Add storage
   *
   * @param {string}         key     Storage key
   * @param {MigrateStorage} storage Storage constuctor
   */
  addStorage (key, storage) {
    this.storages[key] = storage
  }

  /**
   * Return storage instance by key
   *
   * @param {string} key Storage key
   *
   * @return {MigrateStroage}
   */
  getStorage (key = null) {
    // Check if storage can be resolve
    if (!key && !this.config.storage) throw new Error('@midgar/migrate: No storage found !')

    // If key is not set us storage from config
    if (!key) key = this.config.storage

    // Check if storage exist
    if (!this.storages[key]) throw new Error(`@midgar/migrate: Invalid storage key: ${key} !`)

    // Check if instance exist
    if (!this._storageInstances[key]) this._storageInstances[key] = new (this.storages[key])(this.mid)

    return this._storageInstances[key]
  }

  /**
   * Return true if the migration already executed or false
   *
   * @param {string}            name               Migration filename
   * @param {string}            plugin             Plugin name
   * @param {string}            type               Migration type (schema | data)
   * @param {Array<Migration>}  executedMigrations Executed migrations
   *
   * @return {boolean}
   * @return private
   */
  _isExecuted (name, plugin, type, executedMigrations) {
    // List executed migration
    for (const executedMigration of executedMigrations) {
      // Check if the migration is already executed
      if (plugin === executedMigration.plugin && name === executedMigration.name &&
        type === executedMigration.type) {
        return true
      }
    }

    return false
  }

  /**
   * Return an array of executed migration from storage
   *
   * @param {MigrateStorage} storage Storage instance
   *
   * @return {Promise<Array<Migration>>}
   * @private
   */
  async _getExecutedMigrations (storage) {
    // Create table if not exist
    const isInstalled = await storage.isInstalled()
    if (!isInstalled) return []

    // Get execusted migration from storage
    return storage.getMigrations()
  }

  /**
   * Conpare version number with semver to sort migration file
   *
   * @param {string} a First version to compare
   * @param {string} b Second version to compare
   *
   * @return {Number}
   * @private
   */
  _compareVersion (a, b) {
    if (a === b) return 0
    if (semver.lt(a, b)) return -1

    return 1
  }

  /**
   * Return pending migrations
   *
   * @param {string}  storageKey Storage key
   * @param {boolean} import_    Flag to import or not modules
   *
   * @returns {Promise<Array<ModuleFile>>}
   */
  async getPendingMigrations (storageKey, _import = false) {
    const storage = this.getStorage(storageKey)
    // Get plugin names sorted by dependency order
    const dependenciesOrder = this.mid.pm.getSortedPlugins()

    // Get plugin schema dirs, data dirs and executed migrations
    const [schemaModules, dataModules, executedMigrations] = await Promise.all([
      this._importSchemaModules(_import),
      this._importDataModules(_import),
      this._getExecutedMigrations(storage)
    ])

    const migrationModules = {
      schema: schemaModules,
      data: dataModules
    }

    return this._getPendingMigrations(migrationModules, executedMigrations, dependenciesOrder)
  }

  /**
   * Return pending migrations from executed migrations
   *
   * @param {object}            migrationModules        Schema and data migrations modules
   * @param {Array<ModuleFile>} migrationModules.schema Schema migrations module
   * @param {Array<ModuleFile>} migrationModules.data   Data migrations module
   * @param {Array<Migration>}  executedMigrations      Executed migration from storage
   * @param {Array<string>}     dependenciesOrder       Plugin names sorted by dependencies order
   *
   * @returns {Array<ModuleFile>}
   * @private
   */
  _getPendingMigrations (migrationModules, executedMigrations, dependenciesOrder) {
    // Result array
    const pendingMigrations = []

    // List plugins in dependencies order
    for (const plugin of dependenciesOrder) {
      const pending = {
        plugin,
        schema: [],
        data: []
      }

      for (const type in migrationModules) {
        const moduleFiles = migrationModules[type]

        // List module files
        for (const file of moduleFiles) {
          // If file have save plugin add is not executed
          if (file.plugin === plugin && !this._isExecuted(file.relativePath, plugin, type, executedMigrations)) {
            file.type = type
            pending[type].push(file)
          }
        }

        // Sort
        pending[type].sort((a, b) => {
          // Extract version number from file name
          const versionA = a.relativePath.match(this._fileNameRegExp)[1]
          const versionB = b.relativePath.match(this._fileNameRegExp)[1]
          return this._compareVersion(versionA, versionB)
        })
      }

      pendingMigrations.push(...pending.schema, ...pending.data)
    }

    return pendingMigrations
  }

  /**
   * Return all schema module files
   *
   * @param {boolean} import_ Flag to import or not modules
   *
   * @return {Array<ModuleFile>}
   * @private
   */
  _importSchemaModules (_import) {
    return this.mid.pm.importModules(this.plugin.schemaModuleTypeKey, _import)
  }

  /**
   * Return all data module files
   *
   * @param {boolean} import_ Flag to import or not modules
   *
   * @return {Array<ModuleFile>}
   * @private
   */
  _importDataModules (_import) {
    return this.mid.pm.importModules(this.plugin.dataModuleTypeKey, _import)
  }

  /**
   * Execute num pending migrations
   *
   * @param {int}    num        Number of version to execute
   * @param {string} storageKey Storage key
   *
   * @return {Promise<Array<ExecutedMigration>>}
   */
  async up (num = null, storageKey = null) {
    const storage = this.getStorage(storageKey)
    this.mid.info(`@midgar/migrate: up ${num || 'all'} ${storageKey || this.config.storage}`)

    const pendingMigrations = await this.getPendingMigrations(storageKey, true)
    if (!pendingMigrations.length) {
      this.mid.warn('@midgar/migrate: No pending migration in storage.')
      return []
    }

    const result = []
    // Parse num to Int
    if (num && typeof num === 'string') num = parseInt(num)
    // If no number version is specified exec all pending
    if (num === null) num = pendingMigrations.length
    if (num && (typeof num !== 'number' || num > pendingMigrations.length)) throw new Error(`@midgar/migrate: Invalid num paramèter: ${num} !`)
    // List migrations sync to exec in order
    for (let i = 0; i < num; i++) {
      const migration = pendingMigrations[i]
      const plugin = migration.plugin
      const type = migration.type
      // List vesion files
      const execTime = await this._execMigration(storage, 'up', migration, type)
      result.push({ plugin, type, name: migration.relativePath, path: migration.path, time: execTime })
    }

    return result
  }

  /**
   * Downgrade num executed migrations
   *
   * @return {Promise<Array<ExecutedMigration>>}}
   */
  async down (num = null, storageKey = null) {
    const storage = this.getStorage(storageKey)
    this.mid.info(`@midgar/migrate: down ${num || 'all'} ${storageKey || this.config.storage}`)
    // Get files and executed migrations async
    const [schemaFiles, dataFiles, executedMigrations] = await Promise.all([this._importSchemaModules(), this._importDataModules(), this._getExecutedMigrations(storage)])

    if (!executedMigrations.length) {
      this.mid.warn('@midgar/migrate: No executed migration in storage.')
      return []
    }

    executedMigrations.reverse()
    if (num && typeof num === 'string') num = parseInt(num)
    // If no number version is specified exec all executed
    if (num === null) num = executedMigrations.length
    if (num && (typeof num !== 'number' || num > executedMigrations.length)) throw new Error('@midgar/migrate: Invalid num paramèter: ' + num + ' !')
    const result = []
    // List migrations sync to exec in order
    for (let i = 0; i < num; i++) {
      const executedMigration = executedMigrations[i]
      const plugin = executedMigration.plugin
      const type = executedMigration.type

      // Get migrations file to execute
      const files = executedMigration.type === 'schema' ? schemaFiles : dataFiles
      const migrationFile = this._getMigrationModuleFile(executedMigration, files, type)

      // List vesion files
      const execTime = await this._execMigration(storage, 'down', migrationFile, type)
      result.push({ plugin, type, name: migrationFile.relativePath, path: migrationFile.path, time: execTime })
    }

    return result
  }

  /**
   * Return migration module file corresponding to migration Object
   *
   * @param {Migration}         migration      Migration object
   * @param {Array<ModuleFile>} migrationFiles Array of migration module files
   * @param {string}            type           Migration type (schema|data)
   *
   * @return {ModuleFile}
   * @return @private
   */
  _getMigrationModuleFile (migration, migrationFiles, type) {
    for (const file of migrationFiles) {
      if (file.plugin === migration.plugin && file.relativePath === migration.name &&
        type === migration.type) {
        return file
      }
    }

    throw new Error('@midgar/migrate: Migration : ' + JSON.stringify(migration) + ' !')
  }

  /**
   * Check a migration module file
   *
   * @param {ModuleFile} migrationFile Module file object
   * @private
   */
  _checkMigrationModuleFile (migrationFile) {
    if (!migrationFile.export.up) {
      throw new Error(`@midgar/migrate: Not up function in the migration module: ${migrationFile.path} !`)
    }

    // Check type
    if (migrationFile.export.down && ((typeof migrationFile.export.up === 'function' && typeof migrationFile.export.down !== 'function') ||
      (Array.isArray(migrationFile.export.up) && migrationFile.export.down && !Array.isArray(migrationFile.export.down)))) {
      throw new TypeError(`@midgar/migrate: : not same type for the up and down key in the migration module: ${migrationFile.path}.`)
    }

    // Check num items in the array
    if (Array.isArray(migrationFile.export.up) && migrationFile.export.down && migrationFile.export.up.length !== migrationFile.export.down.length) {
      throw new Error(`@midgar/migrate: not same length for the up and down array in the migration module: ${migrationFile.path}.`)
    }
  }

  /**
   * Exec a migration module, save state in storage and return exec time
   *
   * @param {MigrateStorage} storage       Storage instance
   * @param {string}         method        Execution method (up | down)
   * @param {ModuleFile}     migrationFile Migration module file
   * @param {string}         type          Type of migration (schema | data)
   * @param {string}         plugin        Plugin name
   *
   * @return {Promise<number>}
   * @private
   */
  async _execMigration (storage, method, migrationFile, type) {
    this._checkMigrationModuleFile(migrationFile)
    this.mid.debug(`@midgar/migrate: Execute ${method} on ${migrationFile.path}.`)
    const execTime = await this._execMigrationFunc(storage, method, migrationFile.export, !this.config.rollBack === false)
    // Save in storage
    try {
      // if down delete migration or save if it up
      if (method === 'down') {
        await storage.deleteMigration(migrationFile.plugin, migrationFile.relativePath, type)
      } else {
        await storage.saveMigration(migrationFile.plugin, migrationFile.relativePath, type)
      }
    } catch (error) {
      this.mid.error('@midgar/migrate: save migration error !')
      this.mid.error(error)
    }

    return execTime
  }

  /**
   * Execute a migration module
   *
   * @param {MigrateStorage}  storage   Storage instance
   * @param {string}          method    Method to execute (up || down)
   * @param {MigrationModule} migration Migration Module
   * @param {boolean}         rollback  Rollback or not if have an error
   *
   * @return {Promise<number>}
   * @private
   */
  async _execMigrationFunc (storage, method, migration, rollback = false) {
    /**
     * beforeExec event.
     * @event @midgar/migrate:beforeExec
     */
    await this.mid.emit('@midgar/migrate:beforeExec', this, method, migration)

    if (typeof migration.up === 'function') {
      try {
        timer.start('midgar-migrate-exec')
        await migration[method].apply(this, [this.mid, ...storage.getCallArgs()])
        const execTime = timer.getTime('midgar-migrate-exec')
        /**
         * afterExec event.
         * @event @midgar/migrate:afterExec
         */
        await this.mid.emit('@midgar/migrate:afterExec', this, method, migration, execTime)

        return execTime
      } catch (error) {
        this.mid.error('@midgar/migrate: Something bad has happened !')
        this.mid.error(error)

        if (!rollback) {
          throw new Error('@midgar/migrate: Execution fail !')
        }

        this.mid.warn('@midgar/migrate: Rollback !!!')
        // Roll back
        try {
          return this._execMigration(storage, method === 'up' ? 'down' : 'up', migration)
        } catch (rollBackError) {
          this.mid.error(rollBackError)
          throw new Error('@midgar/migrate: Execution fail !')
        }
      }
    }
  }
}

export default {
  name: serviceName,
  service: MigrateService
}
