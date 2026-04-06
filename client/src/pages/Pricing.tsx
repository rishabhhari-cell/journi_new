import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PricingSection from "@/components/PricingSection";
import { useAuth } from "@/contexts/AuthContext";
import { createCheckoutSession } from "@/lib/api/backend";

function BillingBanner({ status }: { status: "success" | "cancelled" }) {
  if (status === "success") {
    return (
      <div
        role="status"
        className="mx-auto mt-6 max-w-xl rounded-xl border border-journi-green/40 bg-journi-green/10 px-5 py-4 text-center text-sm font-medium text-journi-green"
      >
        Payment successful — your Journie Pro subscription is now active!
      </div>
    );
  }
  return (
    <div
      role="status"
      className="mx-auto mt-6 max-w-xl rounded-xl border border-border bg-muted px-5 py-4 text-center text-sm font-medium text-muted-foreground"
    >
      Checkout cancelled. You have not been charged.
    </div>
  );
}

export default function Pricing() {
  const { user, openModal } = useAuth();
  const [, navigate] = useLocation();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Read ?billing=success|cancelled from URL
  const params = new URLSearchParams(window.location.search);
  const billingResult = params.get("billing") as "success" | "cancelled" | null;

  // Clear the query param from the URL after reading it (no re-render)
  useEffect(() => {
    if (billingResult) {
      const url = new URL(window.location.href);
      url.searchParams.delete("billing");
      window.history.replaceState({}, "", url.toString());
    }
  }, [billingResult]);

  // If user just logged in via the modal with a pending checkout, fire immediately
  useEffect(() => {
    if (user && localStorage.getItem("pending_checkout") === "true") {
      localStorage.removeItem("pending_checkout");
      handleCheckout();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleCheckout() {
    setCheckoutError(null);

    if (!user) {
      localStorage.setItem("pending_checkout", "true");
      openModal("signin");
      return;
    }

    setCheckoutLoading(true);
    try {
      const result = await createCheckoutSession("monthly");
      window.location.href = result.data.checkoutUrl;
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        {billingResult && <BillingBanner status={billingResult} />}
        {checkoutError && (
          <div
            role="alert"
            className="mx-auto mt-6 max-w-xl rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-center text-sm font-medium text-destructive"
          >
            {checkoutError}
          </div>
        )}
        <PricingSection onCheckout={handleCheckout} checkoutLoading={checkoutLoading} />
      </main>
      <Footer />
    </div>
  );
}
