const LOGO_URL = "/logos/Journie_logo-cropped.svg"

export default function HeroLogoAnimation() {
  return (
    <div className="w-[78.4%]">
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
