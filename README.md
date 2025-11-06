# Shore Agents Asset Dog

A Next.js application with Prisma ORM, Supabase, and Tailwind CSS.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase project (create one at [supabase.com](https://supabase.com))

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Prisma Database Configuration
# Use the Connection Pooling URL from Supabase Settings > Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:6543/postgres?pgbouncer=true&connect_timeout=15
# Use the direct connection URL for migrations
DIRECT_URL=postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres
```

You can find these values in your Supabase project dashboard under Settings > Database.

### Authentication Setup

The application uses **cookie-based authentication** with Supabase and Next.js API routes.

1. Install the required package (already in dependencies):
   ```bash
   npm install @supabase/ssr
   ```

2. Create a user account in your Supabase project:
   - Go to your Supabase dashboard: https://app.supabase.com
   - Navigate to Authentication > Users
   - Click "Add user" to create a new user with email and password

3. Your environment variables should be set in `.env.local` (see Installation section above)

#### API Routes
- `/api/auth/login` - Handles user login (POST)
- `/api/auth/logout` - Handles user logout (POST)
- `/api/auth/me` - Get current user (GET)

#### Features
- Cookie-based sessions for server-side authentication
- Automatic cookie refresh via middleware
- Protected routes (dashboard requires authentication)
- Automatic redirects (authenticated users can't access login page)

### Database Setup

After setting up your environment variables, generate Prisma Client and run migrations:

```bash
# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Management

```bash
# View database in Prisma Studio
npx prisma studio

# Create a new migration
npx prisma migrate dev --name migration_name

# Push schema changes to database (without creating a migration)
npx prisma db push
```

### Build

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Tech Stack

- **Next.js 16** with **Turbopack** - The React Framework with Rust-powered bundler
- **TypeScript** - Type safety
- **Prisma ORM** - Type-safe database access
- **Supabase** - Backend as a Service (PostgreSQL)
- **Tailwind CSS** - Styling

## Project Structure

```
shoreagents-asset-dog/
├── app/                # Next.js App Router pages
├── lib/                # Utility functions
│   ├── prisma.ts      # Prisma client singleton
│   └── supabase.ts    # Supabase client
├── prisma/             # Prisma schema and migrations
│   └── schema.prisma  # Database schema
├── public/             # Static assets
└── .env.local          # Environment variables (not in git)
```

## Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
