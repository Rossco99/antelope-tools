import React from 'react'
import { createRoot } from 'react-dom/client'
import { ApolloProvider } from '@apollo/client'
import { StylesProvider } from '@mui/styles'

import { ThemeStateProvider } from 'context/theme.context'

import App from './App'
import { client } from './graphql'
import './i18n'

const container = document.getElementById('root')
const root = createRoot(container)

root.render(
  <ApolloProvider client={client}>
    <StylesProvider injectFirst>
      <ThemeStateProvider>
        <App />
      </ThemeStateProvider>
    </StylesProvider>
  </ApolloProvider>,
)
