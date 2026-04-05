import { Footer } from '@/components/shared/Footer'
import { Header } from '@/components/shared/Header'

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-16">{children}</main>
      <Footer />
    </>
  )
}
