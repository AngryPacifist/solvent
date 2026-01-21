import { Redis } from '@upstash/redis'

// Lazy-initialized Redis client
let _redis: Redis | null = null

function getRedis(): Redis {
    if (!_redis) {
        const url = process.env.UPSTASH_REDIS_REST_URL
        const token = process.env.UPSTASH_REDIS_REST_TOKEN

        if (!url || !token) {
            throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables')
        }

        _redis = new Redis({ url, token })
    }
    return _redis
}

// User preferences
export interface UserPrefs {
    alertsEnabled: boolean
    network: 'devnet' | 'mainnet-beta'
    customRpc: string | null
    lastActive: number
}

// Default user preferences
const defaultPrefs: UserPrefs = {
    alertsEnabled: true,
    network: 'devnet',
    customRpc: null,
    lastActive: Date.now(),
}

// Get user preferences
export async function getUserPrefs(chatId: number): Promise<UserPrefs> {
    const redis = getRedis()
    const prefs = await redis.get<UserPrefs>(`user:${chatId}`)
    return prefs || defaultPrefs
}

// Set user preferences
export async function setUserPrefs(chatId: number, prefs: Partial<UserPrefs>): Promise<void> {
    const redis = getRedis()
    const current = await getUserPrefs(chatId)
    await redis.set(`user:${chatId}`, { ...current, ...prefs, lastActive: Date.now() })
}

// Get tracked addresses for user
export async function getTrackedAddresses(chatId: number): Promise<string[]> {
    const redis = getRedis()
    const addresses = await redis.smembers(`tracked:${chatId}`)
    return addresses
}

// Add address to tracking
export async function trackAddress(chatId: number, address: string): Promise<boolean> {
    const redis = getRedis()
    const added = await redis.sadd(`tracked:${chatId}`, address)
    return added > 0
}

// Remove address from tracking
export async function untrackAddress(chatId: number, address: string): Promise<boolean> {
    const redis = getRedis()
    const removed = await redis.srem(`tracked:${chatId}`, address)
    return removed > 0
}

// Get all unique tracked addresses (for cron job)
export async function getAllTrackedAddresses(): Promise<Map<string, number[]>> {
    const redis = getRedis()
    const keys = await redis.keys('tracked:*')
    const addressToUsers = new Map<string, number[]>()

    for (const key of keys) {
        const chatId = parseInt(key.split(':')[1])
        const addresses = await redis.smembers(key)

        for (const addr of addresses) {
            const users = addressToUsers.get(addr) || []
            users.push(chatId)
            addressToUsers.set(addr, users)
        }
    }

    return addressToUsers
}

// Cache scan results for change detection
export interface CachedScan {
    totalAccounts: number
    closeableCount: number
    reclaimableCount: number
    totalRentSOL: number
    lastScan: number
}

export async function getCachedScan(address: string): Promise<CachedScan | null> {
    const redis = getRedis()
    return redis.get<CachedScan>(`cache:${address}`)
}

export async function setCachedScan(address: string, scan: CachedScan): Promise<void> {
    const redis = getRedis()
    // Cache for 1 hour
    await redis.set(`cache:${address}`, scan, { ex: 3600 })
}

// Conversation state management
export type ConversationState = 'idle' | 'waiting_scan' | 'waiting_rpc' | 'waiting_track' | 'waiting_untrack'

export async function getConversationState(chatId: number): Promise<ConversationState> {
    const redis = getRedis()
    const state = await redis.get<ConversationState>(`state:${chatId}`)
    return state || 'idle'
}

export async function setConversationState(chatId: number, state: ConversationState): Promise<void> {
    const redis = getRedis()
    if (state === 'idle') {
        // Delete the key when returning to idle
        await redis.del(`state:${chatId}`)
    } else {
        // State expires after 5 minutes (user abandoned the flow)
        await redis.set(`state:${chatId}`, state, { ex: 300 })
    }
}

export { getRedis as redis }
