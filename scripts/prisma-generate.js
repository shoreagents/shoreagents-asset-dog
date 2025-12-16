#!/usr/bin/env node
/**
 * Prisma generate script that only generates JavaScript client
 * Used in Vercel/production where Python client is not needed
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const tempSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.temp.prisma');

try {
  // Read the original schema
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  
  // Remove the Python generator block
  const modifiedSchema = schemaContent.replace(
    /generator python_client\s*\{[^}]*\}/gs,
    ''
  );
  
  // Write temporary schema
  fs.writeFileSync(tempSchemaPath, modifiedSchema, 'utf8');
  
  // Generate only JavaScript client using temp schema
  console.log('Generating Prisma JavaScript client...');
  execSync(
    `npx prisma generate --schema=${tempSchemaPath}`,
    { stdio: 'inherit', cwd: path.join(__dirname, '..') }
  );
  
  // Clean up temp schema
  fs.unlinkSync(tempSchemaPath);
  
  console.log('✅ Prisma JavaScript client generated successfully');
} catch (error) {
  // Clean up temp schema on error
  if (fs.existsSync(tempSchemaPath)) {
    fs.unlinkSync(tempSchemaPath);
  }
  console.error('❌ Failed to generate Prisma client:', error.message);
  process.exit(1);
}

