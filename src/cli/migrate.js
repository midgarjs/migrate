const MIGRATE_SERVICE_NAME = 'mid:migrate'
const STORAGE_OPTION_FLAGS = '-d, --storage <path>'
const STORAGE_OPTION_DESCRIPTION = 'Migrate storage to use'

/**
 * Up action
 *
 * @param {Midgar}  mid Midgar instance
 * @param {Int}     num Number of version to upgrade
 * @param {Command} cmd Commander command object
 * @private
 */
async function up (mid, num = null, cmd) {
  console.log('up action', num)
  const migrateService = mid.getService(MIGRATE_SERVICE_NAME)
  const migrations = await migrateService.up(num, cmd.storage)
  console.log('/up action', migrations)
  const result = {
    stdout: []
  }

  for (const migration of migrations) {
    result.stdout.push(`Migration executed in ${migration.time}: ${migration.path}.`)
  }

  return result
}

/**
 * Status action
 *
 * @param {Midgar}  mid Midgar instance
 * @param {Command} cmd Commander command object
 * @private
 */
async function status (mid, cmd) {
  /**
   * @type {MigrateService}
   */
  const migrateService = mid.getService(MIGRATE_SERVICE_NAME)
  const pendingMigrations = await migrateService.getPendingMigrations(cmd.storage)

  if (!pendingMigrations.length) return { stdout: ['No pending migation.'] }

  const result = { stdout: [] }
  result.stdout.push(`${pendingMigrations.length} pending migrations:`)
  for (const pendingMigration of pendingMigrations) {
    result.stdout.push(pendingMigration.path)
  }

  return result
}

export default [
  // migrate:up command
  {
    command: 'migrate:up [num]',
    description: 'Migrate up',
    options: [
      {
        flags: STORAGE_OPTION_FLAGS,
        description: STORAGE_OPTION_DESCRIPTION
      }
    ],
    action: up
  },
  // migrate:down command
  {
    command: 'migrate:down [num]',
    description: 'Migrate down',
    options: [
      {
        flags: STORAGE_OPTION_FLAGS,
        description: STORAGE_OPTION_DESCRIPTION
      }
    ],
    action: async (mid, num = null, cmd) => {
      const migrateService = mid.getService(MIGRATE_SERVICE_NAME)
      await migrateService.down(num, cmd.storage)
    }
  },
  // migrate:status command
  {
    command: 'migrate:status',
    description: 'Migrate status',
    options: [
      {
        flags: STORAGE_OPTION_FLAGS,
        description: STORAGE_OPTION_DESCRIPTION
      }
    ],
    action: status
  }
]
