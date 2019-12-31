
import semver from 'semver'
import { assignRecursive, asyncMap } from '@midgar/utils'

/**
 * Service name
 * @type {String}
 */
const serviceName = 'mid:migrate'

/**
 * Midgar migrate service
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
     * @var {Object}
     */
    this.config = assignRecursive({}, this.mid.config.migrate || {}, {})

    /**
      * Migrate plugin instance
      * @var {MigratePlugin}
      */
    this.plugin = this.mid.pm.getPlugin('@midgar/migrate')

    /**
     * Storages
     * @var {Object}
     */
    this.storages = {}

    /**
     * Storage instances
     * @var {Object}
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
   */
  async init () {
    /**
     * init event.
     * @event @midgar/migrate:init
     */
    await this.mid.emit('@midgar/migrate:init', this)
  }

  /**
   * Add storage
   *
   * @param {String}           key     Storage key
   * @param {MigrateStorage} storage Storage instance
   */
  addStorage (key, storage) {
    this.storages[key] = storage
  }

  /**
   * Return storage instance by key
   *
   * @param {String} key Storage key
   *
   * @return {MigrateStroage}
   */
  getStorage (key = null) {
    // Check if storage can be resolve
    if (!key && !this.config.storage) throw new Error('@midgar/migrate: No storage found !')

    // If key is not set us storage from config
    if (!key) key = this.config.storage

    // Check if storage exist
    if (!this.storages[key]) throw new Error('@midgar/migrate: Invalid storage key: ' + key + ' !')

    // Check if instance exist
    if (!this._storageInstances[key]) this._storageInstances[key] = new (this.storages[key])(this.mid)

    return this._storageInstances[key]
  }

  /**
   * Return true if the version file is already executed or false
   *
   * @param {String} versionName      Migration filename
   * @param {String} plugin           Plugin name
   * @param {String} type             Migration type (schema | data)
   * @param {Array}  executedMigrations Executed version files
   *
   * @return {Boolean}
   * @return private
   */
  _isExecuted (versionName, plugin, type, executedMigrations) {
    // List executed version
    for (const executedMigration of executedMigrations) {
      // Check if the version is already executed
      if (plugin === executedMigration.plugin && versionName === executedMigration.name &&
        type === executedMigration.type) {
        return true
      }
    }

    return false
  }

  /**
   * Return an array of executed version from database
   *
   * @param {MigrateStorage} storage Storage instance
   *
   * @return {Array}
   * @private
   */
  async _getExecutedMigrations (storage) {
    // Create table if not exist
    const isInstalled = await storage.isInstalled()
    if (!isInstalled) return []

    // Get version from storage
    return storage.getMigrations()
  }

  /**
   * Conpare version number with semver to sort version file
   *
   * @param {String} a First version to compare
   * @param {String} b Second version to compare
   *
   * @return {Number}
   * @private
   */
  _compareVersion (a, b) {
    a = a.match(this._fileNameRegExp)[1]
    b = b.match(this._fileNameRegExp)[1]

    if (a === b) return 0
    if (semver.lt(a, b)) return -1

    return 1
  }

  /**
   * Return pending migrations
   *
   * @param {String} storageKey Storage key
   *
   * @return {Array}
   */
  async getPendingMigrations (storageKey) {
    const storage = this.getStorage(storageKey)
    // Result array
    const pendingMigrations = []

    // Get plugin names sorted by dependency order
    const dependenciesOrder = this.mid.pm.getSortedPlugins()

    // Get plugin schema dirs, data dirs and executed version
    const [schemaFiles, dataFiles, executedMigrations] = await Promise.all([
      this._getSchematFiles(),
      this._getDataFiles(),
      this._getExecutedMigrations(storage)
    ])

    const dirs = {
      schema: schemaFiles,
      data: dataFiles
    }

    // List plugins in dependencies order
    for (const plugin of dependenciesOrder) {
      const pending = {
        plugin,
        schema: [],
        data: []
      }

      for (const type of Object.keys(dirs)) {
        const files = dirs[type]

        // List files
        for (const file of files) {
          // If file have save plugin add is not executed
          if (file.plugin === plugin && !this._isExecuted(file.relativePath, plugin, type, executedMigrations)) {
            file.type = type
            pending[type].push(file)
          }
        }
        // Sort
        pending[type].sort((a, b) => {
          return this._compareVersion(a.relativePath, b.relativePath)
        })
      }

      pendingMigrations.push(...pending.schema, ...pending.data)
    }

    return pendingMigrations
  }

  /**
   * Return all schema files
   *
   * @return {Array}
   * @private
   */
  _getSchematFiles () {
    return this.mid.pm.importDir(this.plugin.schemaDirKey, this._fileNameRegExp)
  }

  /**
   * Return all data files
   *
   * @param {Array} dependenciesOrder Plugin names sorted by dependency order
   *
   * @return {Array}
   * @private
   */
  _getDataFiles () {
    return this.mid.pm.importDir(this.plugin.dataDirKey, this._fileNameRegExp)
  }

  /**
   * Execute num pending migrations
   *
   * @param {int}    num        Number of version to execute
   * @param {String} storageKey Storage key
   *
   * @return {Array}
   */
  async up (num = null, storageKey = null) {
    const storage = this.getStorage(storageKey)
    this.mid.debug(`@midgar/migrate: up ${num || 'all'} ${storageKey || this.config.storage}`)

    const pendingMigrations = await this.getPendingMigrations(storageKey)
    if (!pendingMigrations.length) {
      this.mid.war('@midgar/migrate: No pending migration in storage.')
      return []
    }

    const result = []
    // Parse num to Int
    if (num && typeof num === 'string') num = parseInt(num)
    // If no number version is specified exec all pending
    if (num === null) num = pendingMigrations.length
    if (num && (typeof num !== 'number' || num > pendingMigrations.length)) throw new Error('@midgar/migrate: Invalid num paramèter: ' + num + ' !')
    // List migrations sync to exec in order
    for (let i = 0; i < num; i++) {
      const version = pendingMigrations[i]
      const plugin = version.plugin
      const type = version.type
      // List vesion files
      const execTime = await this._execMigration(storage, 'up', version, type)
      result.push({ plugin, type, name: version.relativePath, path: version.path, time: execTime })
    }

    return result
  }

  /**
   * Downgrade num executed migrations
   *
   * @return {Array}
   */
  async down (num = null, storageKey = null) {
    const storage = this.getStorage(storageKey)
    this.mid.debug(`@midgar/migrate: down ${num || 'all'} ${storageKey || this.config.storage}`)
    // Get files and executed migrations async
    const [schemaFiles, dataFiles, executedMigrations] = await Promise.all([this._getSchematFiles(), this._getDataFiles(), this._getExecutedMigrations(storage)])

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

      // Get version to execute
      const files = executedMigration.type === 'schema' ? schemaFiles : dataFiles
      const version = this._getMigration(executedMigration, files, type)

      // List vesion files
      const execTime = await this._execMigration(storage, 'down', version, type)
      result.push({ plugin, type, name: version.relativePath, path: version.path, time: execTime })
    }

    return result
  }

  /**
   * Return version file corresponding to excecuted version Oject
   *
   * @param {Object} executedMigration {
   *                                   {Sting} plugin Plugin name
   *                                   {Sting} name   Migration name (relative file path)
   *                                   {Sting} type   Migration type (schema|data)
   *                                 }
   * @param {Array}  files           Array of Object file
   * @param {String} type            Migration type (schema|data)
   *
   * @return {Object}
   * @return @private
   */
  _getMigration (executedMigration, files, type) {
    for (const file of files) {
      if (file.plugin === executedMigration.plugin && file.relativePath === executedMigration.name &&
        type === executedMigration.type) {
        return file
      }
    }

    throw new Error('@midgar/migrate: Invalid version: ' + JSON.stringify(executedMigration) + ' !')
  }

  /**
   * Check a version file anf throw error if it not valid
   *
   * @param {Object} file File object {
   *                                    {String} path         Absolute file path
   *                                    {String} plugin       Plugin name
   *                                    {Sting}  relativePath Relative file path
   *                                    {Object} export {
   *                                      {function || Array} up upgrade function
   *                                      {function || Array} down downgrade function
   *                                    }
   *                                  }
   * @private
   */
  _checkMigrationFile (file) {
    if (!file.export.up) {
      throw new Error('@midgar/migrate: Not up function in the version file : ' + file.path + ' !')
    }

    // Check type
    if (file.export.down && ((typeof file.export.up === 'function' && typeof file.export.down !== 'function') ||
      (Array.isArray(file.export.up) && file.export.down && !Array.isArray(file.export.down)))) {
      throw new TypeError('@midgar/migrate: : not same type for the up and down key in the version file : ' + file.path)
    }

    // Check num items in the array
    if (Array.isArray(file.export.up) && file.export.down && file.export.up.length !== file.export.down.length) {
      throw new Error('@midgar/migrate: not same length for the up and down array in the version file : ' + file.path)
    }
  }

  /**
   * Exec a version file, save state in storage and return exec time
   *
   * @param {MigrateStorage} storage Storage instance
   * @param {String} method   Execution method (up | down)
   * @param {Object} file File object {
   *                                    {String} path         Absolute file path
   *                                    {String} plugin       Plugin name
   *                                    {Sting}  relativePath Relative file path
   *                                    {Object} export {
   *                                      {function || Array} up upgrade function
   *                                      {function || Array} down downgrade function
   *                                    }
   *                                  }
   * @param {String} type     Type of version (schema | data)
   * @param {String} plugin   Plugin name
   *
   * @return {Number}
   * @private
   */
  async _execMigration (storage, method, file, type) {
    this._checkMigrationFile(file)
    this.mid.debug('@midgar/migrate: Execute ' + method + ' on ' + file.path)
    const execTime = await this._execMigrationFunc(storage, method, file.export, !this.config.rollBack === false)
    // Save in storage
    try {
      // if down delete version or save if it up
      if (method === 'down') {
        await storage.deleteMigration(file.plugin, file.relativePath, type)
      } else {
        await storage.saveMigration(file.plugin, file.relativePath, type)
      }
    } catch (error) {
      this.mid.error('@midgar/migratesave version error')
      this.mid.error(error)
    }

    return execTime
  }

  /**
   * Execute a version file
   *
   * @param {MigrateStorage} storage  Storage instance
   * @param {String}         method   method to execute (up || down)
   * @param {Object}         version  version object {
   *                                         {function || Array} up upgrade function
   *                                         {function || Array} down downgrade function
   *                                         }
   * @param {String}         filePath file path for log
   * @param {Boolean}        rollback rollback or not if have an error
   *
   * @return {Promise<Object>}
   * @private
   */
  async _execMigrationFunc (storage, method, version, rollback = false) {
    /**
     * beforeExec event.
     * @event @midgar/migrate:beforeExec
     */
    await this.mid.emit('@midgar/migrate:beforeExec', this, method, version)

    if (typeof version.up === 'function') {
      try {
        // Get exec start time
        const hrStart = process.hrtime()
        await version[method].apply(this, [this.mid, ...storage.getCallArgs()])

        const hrEnd = process.hrtime(hrStart)

        // Return exec time in ms
        const result = (hrEnd[0] * 1000) + (hrEnd[1] / 1000000)
        /**
         * afterExec event.
         * @event @midgar/migrate:afterExec
         */
        await this.mid.emit('@midgar/migrate:afterExec', this, method, version, result)

        return result
      } catch (error) {
        this.mid.debug('@midgar/migrate: Something bad has happened !')
        this.mid.debug(error)

        if (!rollback) {
          throw new Error('@midgar/migrate: Execution fail !')
        }

        this.mid.warn('@midgar/migrate: Rollback !!!')
        // Roll back
        try {
          return this._execMigration(storage, method === 'up' ? 'down' : 'up', version)
        } catch (error) {
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
