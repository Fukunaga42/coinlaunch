```ts
// /app/Providers.tsx
'use client';
import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
    },
  })
}
let browserQueryClient: QueryClient | undefined = undefined
function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}
export default function Providers({ children }: Readonly<{children: React.ReactNode}>) {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
// /app/layout.tsx
import Providers from './providers'
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head />
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
// /app/page.tsx
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { gql, request } from 'graphql-request'
import Data from '@/components/Data.tsx'

const query = gql`{
  tokens(first: 5) {
    id
    address
    creator
    name
  }
  transactions(first: 5) {
    id
    hash
    type
    token {
      id
    }
  }
}`
const url = 'https://api.studio.thegraph.com/query/112708/thelaunch/version/latest'
const headers = { Authorization: 'Bearer {api-key}' }

export default async function HomePage() {
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({
    queryKey: ['data'],
    async queryFn() {
      return await request(url, query, {}, headers)
    }
  })
  return (
    // Neat! Serialization is now as easy as passing props.
    // HydrationBoundary is a Client Component, so hydration will happen there.
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Data />
    </HydrationBoundary>
  )
}
// /components/Data.tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { gql, request } from 'graphql-request'

const query = gql`{
  tokens(first: 5) {
    id
    address
    creator
    name
  }
  transactions(first: 5) {
    id
    hash
    type
    token {
      id
    }
  }
}`
const url = 'https://api.studio.thegraph.com/query/112708/thelaunch/version/latest'
const headers = { Authorization: 'Bearer {api-key}' }

export default function Data() {
  // the data is already pre-fetched on the server and immediately available here,
  // without an additional network call
  const { data } = useQuery({
    queryKey: ['data'],
    async queryFn() {
      return await request(url, query, {}, headers)
    }
  })
  return <div>{JSON.stringify(data ?? {})}</div>
}
      
```