import '../styles/globals.css'
import { ProjectCartProvider } from '../lib/projectCart'

export default function App({ Component, pageProps }) {
  return <ProjectCartProvider><Component {...pageProps} /></ProjectCartProvider>
}
