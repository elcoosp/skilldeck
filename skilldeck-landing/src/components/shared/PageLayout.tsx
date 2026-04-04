import { Header } from '@/components/shared/Header'
import { Footer } from '@/components/shared/Footer'

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-16">{children}</main>
      <Footer />
    </>
  )
}
