import path from 'path'
import mocha from 'mocha'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import chaiArrays from 'chai-arrays'
import _rimraf from 'rimraf'
import fs from 'fs'
import os from 'os'
import uid from 'uid-safe'
import { timer } from '@midgar/utils'

/**
 * @type {Midgar}
 */
import { Cli } from '@midgar/midgar'
import testMigrateStorage from './fixtures/test-storage'

// fix for TypeError: describe is not a function with mocha-teamcity-reporter
const { describe, it } = mocha

const expect = chai.expect
chai.use(dirtyChai)
chai.use(chaiArrays)

const STORAGE_KEY = 'test-storage'
const configPath = path.resolve(__dirname, 'fixtures/config')

/**
 * Promised rimraf
 * @param {Sting} rmPath Path
 * @private
 */
function rimraf (rmPath) {
  return new Promise((resolve, reject) => {
    _rimraf(rmPath, resolve)
  })
}

/**
 * Create random dir in tmp os directory and return it
 * @private
 */
function getTmpDir () {
  const dirname = path.join(os.tmpdir(), uid.sync(8))
  fs.mkdirSync(dirname, { mode: parseInt('0700', 8) })
  return dirname
}
let tmpDir = null

/**
 * Run cli command
 * @private
 */
async function runCliCmd (cmd, args = []) {
  const cli = new Cli(['', '', cmd, '--config', configPath, ...args])

  //
  cli.mid.on('@midgar/migrate:init', async (migrateService) => {
    migrateService.addStorage(STORAGE_KEY, testMigrateStorage)
    const storage = await migrateService.getStorage(STORAGE_KEY)
    storage.tmpDir = tmpDir
  })

  await cli.init()
  const result = await cli.run()

  return {
    cli,
    result
  }
}

const shouldResult = (type) => [
  type + '-0.1.0-test2.js',
  type + '-0.1.0-test.js',
  type + '-0.1.0-create-test-data.js',
  type + '-0.1.0-test3.js',
  type + '-0.1.1-test3.js',
  type + '-1.1.1-test3.js'
]

/**
 * Migrate test
 */
describe('Migrate', function () {
  before(() => {
    // Create tmp dir
    tmpDir = getTmpDir()
  })

  after(async () => {
    // clean tmp dir
    await rimraf(tmpDir)
  })

  // Test db:up command
  it('up all', async () => {
    this.timeout(10000)
    timer.start('test-up-all')
    console.log('up all 1')
    const { cli } = await runCliCmd('migrate:up', ['--storage', STORAGE_KEY])
    let time = timer.getTime('test-up-all')
    console.log('up all 2', time + ' ms')
    const storage = cli.mid.getService('mid:migrate').getStorage(STORAGE_KEY)
    time = timer.getTime('test-up-all')
    console.log('up all 3', time + ' ms')
    expect(storage.result).to.eql(shouldResult('up'))
    console.log('up all 4')
  })

  it('down all', async () => {
    const { cli } = await runCliCmd('migrate:down', ['--storage', STORAGE_KEY])
    const storage = cli.mid.getService('mid:migrate').getStorage(STORAGE_KEY)
    expect(storage.result).to.eql(shouldResult('down').reverse())
  })

  // Test db:up command
  it('up', async () => {
    const upResult = shouldResult('up')
    // Up 1 by 1
    for (let i = 0; i < upResult.length; i++) {
      const { cli } = await runCliCmd('migrate:up', [(1).toString(), '--storage', STORAGE_KEY])
      const storage = cli.mid.getService('mid:migrate').getStorage(STORAGE_KEY)
      expect(storage.result).to.eql([upResult[i]])
    }
  })

  it('status full', async () => {
    const { result } = await runCliCmd('migrate:status', ['--storage', STORAGE_KEY])
    expect(result.stdout).to.be.containing('No pending migation.')
  })

  // Test db:up command
  it('down', async () => {
    const downResult = shouldResult('down').reverse()
    for (let i = 0; i < downResult.length; i++) {
      const { cli } = await runCliCmd('migrate:down', [(1).toString(), '--storage', STORAGE_KEY])
      const storage = cli.mid.getService('mid:migrate').getStorage(STORAGE_KEY)
      // Remove down result
      expect(storage.result).to.eql([downResult[i]])
    }
  })

  it('status empty', async () => {
    const { result } = await runCliCmd('migrate:status', ['--storage', STORAGE_KEY])
    expect(result.stdout.length).to.eql(shouldResult('down').length + 1)
  })
})
