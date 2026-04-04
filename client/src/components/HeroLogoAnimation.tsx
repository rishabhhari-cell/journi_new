const LOGO_URL = "/logos/Journie_logo.svg"

export default function HeroLogoAnimation() {
  return (
    <div className="w-[67.5%]">
      <img
        src={LOGO_URL}
        alt="Journie"
        className="w-full h-auto object-contain object-left"
        loading="eager"
        fetchPriority="high"
      />
    </div>
  )
}
