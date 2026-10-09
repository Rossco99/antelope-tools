import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { getMainDefinition } from '@apollo/client/utilities'
import { createClient } from 'graphql-ws'

import { graphqlConfig } from './config'

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')

  return token ? { Authorization: `Bearer ${token}` } : {}
}

const httpLink = createHttpLink({
  uri: graphqlConfig.url
})

const authLink = setContext((_, { headers }) => ({
  headers: {
    ...headers,
    ...getAuthHeaders()
  }
}))

const wsLink = new GraphQLWsLink(
  createClient({
    url: graphqlConfig.url.replace(/^http/, 'ws'),
    lazy: true,
    retryAttempts: Infinity,
    connectionParams: () => ({ headers: getAuthHeaders() })
  })
)

const link = split(
  ({ query }) => {
    const definition = getMainDefinition(query)

    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    )
  },
  wsLink,
  authLink.concat(httpLink)
)

export const client = new ApolloClient({
  link,
  cache: new InMemoryCache()
})
