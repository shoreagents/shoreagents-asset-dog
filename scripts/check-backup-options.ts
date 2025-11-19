import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkBackupOptions() {
  try {
    console.log('🔍 Checking database backup and recovery options...\n')

    // Check PostgreSQL version
    const version = await prisma.$queryRaw<Array<{ version: string }>>`
      SELECT version()
    `
    console.log('📊 Database Version:')
    console.log(`   ${version[0]?.version}\n`)

    // Check if WAL archiving is enabled (for point-in-time recovery)
    const walLevel = await prisma.$queryRaw<Array<{ setting: string }>>`
      SELECT setting FROM pg_settings WHERE name = 'wal_level'
    `
    console.log('📦 WAL Archiving:')
    console.log(`   WAL Level: ${walLevel[0]?.setting || 'Not configured'}`)
    console.log('   (Point-in-time recovery requires WAL archiving)\n')

    // Check last backup time (if pg_backup extension exists)
    try {
      const lastBackup = await prisma.$queryRaw<Array<{ last_backup: Date }>>`
        SELECT MAX(backup_finished_at) as last_backup
        FROM pg_backup_history
        LIMIT 1
      `.catch(() => [])
      
      if (lastBackup.length > 0 && lastBackup[0]?.last_backup) {
        console.log('💾 Last Backup:')
        console.log(`   ${lastBackup[0].last_backup}\n`)
      } else {
        console.log('💾 Last Backup:')
        console.log('   No backup history found in database\n')
      }
    } catch (e) {
      console.log('💾 Last Backup:')
      console.log('   Backup history table not available\n')
    }

    console.log('📋 Recovery Options:')
    console.log('   1. Check Supabase Dashboard for automatic backups')
    console.log('   2. Check if you have manual database backups')
    console.log('   3. Check application logs for the deleted record data')
    console.log('   4. Recreate records manually if you have the original data\n')

    console.log('⚠️  IMPORTANT:')
    console.log('   - The deleted records are permanently gone from the database')
    console.log('   - You can only restore if you have a backup')
    console.log('   - Supabase Pro/Team plans have automatic daily backups')
    console.log('   - Check your Supabase project dashboard for backup options\n')

  } catch (error) {
    console.error('❌ Error checking backup options:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkBackupOptions()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

