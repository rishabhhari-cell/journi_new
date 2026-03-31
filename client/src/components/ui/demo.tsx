import StickyFooter from "@/components/ui/footer"

const DemoOne = () => {
  return (
    <main className="bg-background text-foreground">
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background via-muted to-background px-4 text-[4vw] md:text-[2vw]">
        <div className="text-center">
          <h2 className="mb-6 bg-gradient-to-r from-foreground via-muted-foreground to-foreground/60 bg-clip-text font-serif leading-none text-transparent">
            This is an example of a sticky footer
          </h2>
          <div className="mx-auto h-0.5 w-16 bg-gradient-to-r from-primary to-secondary md:w-24"></div>
        </div>
      </div>

      <StickyFooter />
    </main>
  )
}

export { DemoOne }

