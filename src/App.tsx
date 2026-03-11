import { Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { Home } from './pages/Home'
import { Market } from './pages/Market'
import { SyncTrade } from './pages/SyncTrade'
import { Options } from './pages/Options'
import { Assets } from './pages/Assets'
import { Login } from './pages/Login'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/market" element={<Market />} />
        <Route path="/sync" element={<SyncTrade />} />
        <Route path="/options" element={<Options />} />
        <Route path="/assets" element={<Assets />} />
      </Routes>
    </Layout>
  )
}

export default App
