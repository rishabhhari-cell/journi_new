const LOGO_URL = "/logos/Journi_new-cropped (1).svg"

export default function HeroLogoAnimation() {
  return (
    <div className="w-[67.5%]">
      <img
        src={LOGO_URL}
        alt="Journi"
        className="w-full h-auto object-contain object-left"
        loading="eager"
        fetchPriority="high"
      />
    </div>
  )
}
