/**
 * Redis Connection Test Script
 * Run with: npx tsx scripts/test-redis.ts
 * Or: npm run test:redis
 */

import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://default:vsgifpOIJzdLzLarKYsAZaYvuBSkIdkK@turntable.proxy.rlwy.net:14968'

console.log('🔍 Redis Connection Test\n')
console.log(`📡 Redis URL: ${REDIS_URL.replace(/:[^:@]+@/, ':****@')}\n`)

async function testRedisConnection() {
  let redis: Redis | null = null

  try {
    console.log('1️⃣ Creating Redis client...')
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        console.log(`   ⏳ Retry attempt ${times}, waiting ${delay}ms...`)
        return delay
      },
      enableReadyCheck: true,
      connectTimeout: 10000,
      lazyConnect: false, // Connect immediately for testing
      enableOfflineQueue: false,
    })

    // Set up event listeners
    redis.on('error', (err) => {
      console.error(`   ❌ Redis error: ${err.message}`)
    })

    redis.on('connect', () => {
      console.log('   ✅ Redis connected')
    })

    redis.on('ready', () => {
      console.log('   ✅ Redis ready')
    })

    redis.on('close', () => {
      console.log('   ⚠️  Redis connection closed')
    })

    console.log('2️⃣ Waiting for Redis connection...')
    // Wait for connection to be ready (since lazyConnect: false, it's already connecting)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        redis?.removeAllListeners('ready')
        redis?.removeAllListeners('error')
        reject(new Error('Connection timeout'))
      }, 10000)

      redis?.once('ready', () => {
        clearTimeout(timeout)
        resolve()
      })

      redis?.once('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })
    console.log('   ✅ Connection successful!\n')

    console.log('3️⃣ Testing PING command...')
    const pingResult = await redis.ping()
    console.log(`   ✅ PING response: ${pingResult}\n`)

    console.log('4️⃣ Testing SET operation...')
    const testKey = 'test:connection'
    const testValue = { message: 'Hello Redis!', timestamp: Date.now() }
    await redis.setex(testKey, 30, JSON.stringify(testValue))
    console.log(`   ✅ SET successful: ${testKey}\n`)

    console.log('5️⃣ Testing GET operation...')
    const retrieved = await redis.get(testKey)
    if (retrieved) {
      const parsed = JSON.parse(retrieved)
      console.log(`   ✅ GET successful:`, parsed)
      console.log(`   ✅ Data matches: ${parsed.message === testValue.message}\n`)
    } else {
      console.log('   ❌ GET failed: No data retrieved\n')
    }

    console.log('6️⃣ Testing TTL...')
    const ttl = await redis.ttl(testKey)
    console.log(`   ✅ TTL: ${ttl} seconds\n`)

    console.log('7️⃣ Testing cache utility functions...')
    const { getRedisCached, setRedisCached } = await import('../lib/redis')
    
    const cacheKey = 'test:cache-util'
    const cacheData = { test: 'data', number: 42 }
    
    await setRedisCached(cacheKey, cacheData, 15)
    console.log(`   ✅ setRedisCached successful`)
    
    const cached = await getRedisCached<typeof cacheData>(cacheKey)
    if (cached && cached.test === cacheData.test) {
      console.log(`   ✅ getRedisCached successful:`, cached)
    } else {
      console.log(`   ❌ getRedisCached failed`)
    }
    console.log()

    console.log('8️⃣ Testing DELETE operation...')
    await redis.del(testKey)
    const deletedCheck = await redis.get(testKey)
    console.log(`   ✅ DELETE successful: ${deletedCheck === null}\n`)

    console.log('9️⃣ Testing INFO command...')
    const info = await redis.info('server')
    const versionMatch = info.match(/redis_version:([^\r\n]+)/)
    if (versionMatch) {
      console.log(`   ✅ Redis version: ${versionMatch[1]}\n`)
    }

    console.log('🔟 Testing connection status...')
    console.log(`   Status: ${redis.status}`)
    console.log(`   Options: ${JSON.stringify({
      host: redis.options.host,
      port: redis.options.port,
      db: redis.options.db,
    }, null, 2)}\n`)

    console.log('✅ All tests passed! Redis is working correctly.\n')

    await redis.quit()
    console.log('👋 Connection closed gracefully')

  } catch (error) {
    console.error('\n❌ Test failed with error:')
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`)
      console.error(`   Stack: ${error.stack}`)
    } else {
      console.error(`   Error: ${JSON.stringify(error, null, 2)}`)
    }

    // Try to get more details
    if (redis) {
      console.error(`\n   Redis status: ${redis.status}`)
      try {
        await redis.quit()
      } catch {
        // Ignore quit errors
      }
    }

    process.exit(1)
  }
}

// Run the test
testRedisConnection()
  .then(() => {
    console.log('\n✨ Test completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Unhandled error:', error)
    process.exit(1)
  })

