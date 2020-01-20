import path from 'path'
import { asyncReadFile, asyncFileExists, asyncWriteFile } from '@midgar/utils'

const STORAGE_FILE = 'storage.json'

/**
 * Test storage class
 */
export default class TestStorage {
  constructor (mid) {
    this.mid = mid
    this.migrations = null
    this.tmpDir = null
    this.result = []
  }

  async isInstalled () {
    return true
  }

  async getMigrations () {
    if (this.migrations === null) {
      const filePath = path.join(this.tmpDir, STORAGE_FILE)
      if (await asyncFileExists(filePath)) {
        const content = await asyncReadFile(filePath, 'utf8')
        this.migrations = JSON.parse(content)
      } else {
        this.migrations = []
      }
    }

    return [...this.migrations]
  }

  /**
   * Save executed migration in storage
   *
   * @param {string} plugin Plugin name
   * @param {string} name   Version file name
   * @param {string} type   Version type (schema|data)
   */
  async saveMigration (plugin, name, type) {
    this.migrations.push({ plugin, name, type })
    const filePath = path.join(this.tmpDir, STORAGE_FILE)
    await asyncWriteFile(filePath, JSON.stringify(this.migrations))
  }

  /**
   * Delete executed migration in database
   *
   * @param {string} plugin Plugin name
   * @param {string} name   Version file name
   * @param {string} type   Version type (schema|data)
   *
   * @returns {Version} Sequelize migration model
   */
  async deleteMigration (plugin, name, type) {
    for (const index in this.migrations) {
      const migration = this.migrations[index]
      if (plugin === migration.plugin && name === migration.name && type === migration.type) {
        this.migrations.splice(index, 1)
        break
      }
    }
    const filePath = path.join(this.tmpDir, STORAGE_FILE)
    await asyncWriteFile(filePath, JSON.stringify(this.migrations))
  }

  getCallArgs () {
    return [
      'test_arg1',
      'test_arg2'
    ]
  }
}
