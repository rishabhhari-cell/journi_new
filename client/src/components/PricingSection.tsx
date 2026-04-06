import PricingSection5 from "@/components/ui/pricing";

interface PricingSectionProps {
  onCheckout?: () => void;
  checkoutLoading?: boolean;
}

export default function PricingSection({ onCheckout, checkoutLoading }: PricingSectionProps) {
  return <PricingSection5 onCheckout={onCheckout} checkoutLoading={checkoutLoading} />;
}

