'use client'

import { useState } from 'react'
import { Menu, X, Download, Github, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { useLingui } from '@lingui/react/macro'

function SkillDeckLogo() {
  return (
    <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-sm">
      <Layers className="w-4 h-4 text-white" />
    </div>
  )
}

export function Header() {
  const { t } = useLingui()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = [
    { label: t`Features`, href: '/#features' },
    { label: t`Blog`, href: '/blog' },
    { label: t`Compare`, href: '/compare' },
    { label: t`Docs`, href: '/#how-it-works' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2 group">
            <SkillDeckLogo />
            <span className="text-lg font-bold tracking-tight">Skill<span className="gradient-blue">Deck</span></span>
          </a>
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-white/5">{link.label}</a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <a href="https://github.com/elcoosp/skilldeck" target="_blank" rel="noopener noreferrer" className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-white/5" aria-label={t`View on GitHub`}>
              <Github className="w-5 h-5" />
            </a>
            <Button size="sm" className="bg-gradient-to-r from-blue-800 to-blue-500 hover:from-blue-500 hover:to-blue-800 text-white border-0 shadow-lg shadow-blue-500/25">
              <Download className="w-4 h-4 mr-2" />{t`Download`}
            </Button>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label={t`Toggle menu`}>
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background border-border p-0">
              <SheetTitle className="sr-only">{t`Navigation Menu`}</SheetTitle>
              <div className="flex flex-col gap-6 px-6 pt-8 pb-6">
                <a href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <SkillDeckLogo />
                  <span className="text-lg font-bold">Skill<span className="gradient-blue">Deck</span></span>
                </a>
                <nav className="flex flex-col gap-1">
                  {navLinks.map((link) => (
                    <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="px-3 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-white/5">{link.label}</a>
                  ))}
                </nav>
                <div className="flex flex-col gap-3 mt-2">
                  <Button className="bg-gradient-to-r from-blue-800 to-blue-500 hover:from-blue-500 hover:to-blue-800 text-white border-0 w-full" asChild>
                    <a href="/download"><Download className="w-4 h-4 mr-2" />{t`Download`}</a>
                  </Button>
                  <a href="https://github.com/elcoosp/skilldeck" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg border border-border">
                    <Github className="w-4 h-4" />{t`View on GitHub`}
                  </a>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
