import { pgTable, uuid, varchar, jsonb, numeric, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// -----------------------------------------------------------------------------
// 1. IDENTITY LAYER
// -----------------------------------------------------------------------------
export const curators = pgTable('curators', {
    walletAddress: varchar('wallet_address', { length: 42 }).primaryKey(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const curatorsRelations = relations(curators, ({ many }) => ({
    curatorialGraphs: many(curatorialGraphs),
}));

// -----------------------------------------------------------------------------
// 2. CHANNELS (CURATORIAL GRAPHS)
// -----------------------------------------------------------------------------
export const curatorialGraphs = pgTable('curatorial_graphs', {
    id: uuid('id').primaryKey().defaultRandom(),
    curatorWallet: varchar('curator_wallet', { length: 42 })
        .notNull()
        .references(() => curators.walletAddress, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    rules: jsonb('rules').$type<string[]>().default([]).notNull(),
    stakeAmount: numeric('stake_amount', { precision: 18, scale: 0 }).default('0').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const curatorialGraphsRelations = relations(curatorialGraphs, ({ one, many }) => ({
    curator: one(curators, {
        fields: [curatorialGraphs.curatorWallet],
        references: [curators.walletAddress],
    }),
    broadcasts: many(broadcasts),
}));

// -----------------------------------------------------------------------------
// 3. BROADCASTS (Live node instantiations of a Channel)
// -----------------------------------------------------------------------------
export const broadcasts = pgTable('broadcasts', {
    id: uuid('id').primaryKey().defaultRandom(),
    graphId: uuid('graph_id')
        .notNull()
        .references(() => curatorialGraphs.id, { onDelete: 'cascade' }),
    broadcasterWallet: varchar('broadcaster_wallet', { length: 42 }).notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    endedAt: timestamp('ended_at'),
});

export const broadcastsRelations = relations(broadcasts, ({ one, many }) => ({
    graph: one(curatorialGraphs, {
        fields: [broadcasts.graphId],
        references: [curatorialGraphs.id],
    }),
    sessions: many(sessions),
}));

// -----------------------------------------------------------------------------
// 4. GRAPH EDGES (PoC SESSIONS)
// -----------------------------------------------------------------------------
// This table acts as the spatial trace between a listener and a broadcaster.
// It is the raw material from which Flow Energy / Retention Mathematics are generated.
export const sessions = pgTable('sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    broadcastId: uuid('broadcast_id')
        .notNull()
        .references(() => broadcasts.id, { onDelete: 'cascade' }),
    listenerId: varchar('listener_id', { length: 42 }).notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    leftAt: timestamp('left_at'),
}, (table) => ({
    // Optimization: Queries will frequently aggregate listener sessions bounded by a specific broadcast
    broadcastListenerIdx: uniqueIndex('broadcast_listener_idx').on(table.broadcastId, table.listenerId, table.joinedAt),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
    broadcast: one(broadcasts, {
        fields: [sessions.broadcastId],
        references: [broadcasts.id],
    }),
}));
