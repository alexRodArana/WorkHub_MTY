#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

require(path.resolve(__dirname, '../luminaBack-main/node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../luminaBack-main/.env'),
})

const { Pool } = require(path.resolve(__dirname, '../luminaBack-main/node_modules/pg'))

const OUTPUT_FILE = path.resolve(__dirname, '02_seed_static.sql')

const TABLES = [
  {
    name: 'roles',
    columns: ['id', 'name', 'description', 'permissions'],
    identity: true,
    order: 'id',
  },
  {
    name: 'buildings',
    columns: ['id', 'name', 'location', 'total_spaces', 'is_active', 'created_at'],
    identity: true,
    order: 'id',
  },
  {
    name: 'floors',
    columns: ['id', 'building_id', 'floor_number', 'name', 'total_spaces', 'is_active', 'created_at', 'plan_image_url'],
    identity: true,
    order: 'id',
  },
  {
    name: 'badges',
    columns: ['id', 'key', 'name', 'description', 'tier'],
    identity: false,
    order: 'id',
  },
  {
    name: 'parking_zones',
    columns: ['id', 'name', 'priority_order', 'created_at'],
    identity: false,
    order: 'priority_order, id',
  },
  {
    name: 'parking_spots',
    columns: ['id', 'zone_id', 'spot_number', 'is_active', 'created_at'],
    identity: false,
    order: 'zone_id, spot_number',
  },
  {
    name: 'spaces',
    columns: [
      'id',
      'floor_id',
      'space_number',
      'priority_category',
      'is_active',
      'created_at',
      'layout_type',
      'layout_direction',
      'layout_cx',
      'layout_cy',
      'layout_points',
      'visual_only',
      'display_name',
    ],
    identity: true,
    order: 'floor_id, space_number',
  },
]

function quoteString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL'
  if (value instanceof Date) return quoteString(value.toISOString())
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return `${quoteString(JSON.stringify(value))}::jsonb`
  return quoteString(value)
}

function chunk(rows, size) {
  const chunks = []
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }
  return chunks
}

async function exportTable(pool, table) {
  const result = await pool.query(
    `SELECT ${table.columns.map((column) => `"${column}"`).join(', ')}
     FROM ${table.name}
     ORDER BY ${table.order}`
  )

  if (result.rows.length === 0) return `-- ${table.name}: no rows\n`

  const statements = []
  const columnList = table.columns.map((column) => `"${column}"`).join(', ')
  const override = table.identity ? ' OVERRIDING SYSTEM VALUE' : ''

  for (const rows of chunk(result.rows, 120)) {
    const values = rows
      .map((row) => `  (${table.columns.map((column) => sqlValue(row[column])).join(', ')})`)
      .join(',\n')

    statements.push(
      `INSERT INTO ${table.name} (${columnList})${override}\nVALUES\n${values}\nON CONFLICT DO NOTHING;`
    )
  }

  statements.push(
    `SELECT setval(pg_get_serial_sequence('public.${table.name}', 'id'), COALESCE((SELECT MAX(id) FROM ${table.name}), 1), true);`
  )

  return `-- ${table.name}\n${statements.join('\n\n')}\n`
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to export static seed data')
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    const parts = [
      '-- WorkHub MTY static seed exported from Supabase.',
      '-- Contains only catalog/inventory data: roles, floors, spaces, parking and badges.',
      '-- Demo users/reservations are created by luminaBack-main/seed_production_demo_data.ts.',
      '',
      'BEGIN;',
      '',
    ]

    for (const table of TABLES) {
      parts.push(await exportTable(pool, table))
    }

    parts.push('COMMIT;\n')
    fs.writeFileSync(OUTPUT_FILE, parts.join('\n'), 'utf8')
    console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_FILE)}`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
