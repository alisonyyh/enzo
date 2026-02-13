import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Sparkles } from "lucide-react";

interface RoutineRevealProps {
  puppyName: string;
  onDismiss: () => void;
}

export function RoutineReveal({ puppyName, onDismiss }: RoutineRevealProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onDismiss, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("hasSeenReveal", "true");
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center p-5 z-50 transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleDismiss}
    >
      <div
        className={`w-full max-w-[350px] bg-card rounded-3xl p-8 text-center space-y-4 transform transition-all duration-300 ${
          show ? "scale-100" : "scale-95"
        }`}
        style={{
          boxShadow: '0 4px 24px rgba(45, 27, 14, 0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center">
          <div className="bg-accent rounded-full p-4 animate-bounce">
            <Sparkles className="size-12 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-foreground">Your routine is ready!</h2>
        <p className="text-base text-muted-foreground">
          We've created a personalized daily routine for {puppyName}
        </p>
        <button
          onClick={handleDismiss} 
          className="w-full h-[50px] bg-primary hover:bg-[#D4661F] text-primary-foreground rounded-xl text-base font-semibold transition-colors"
        >
          View {puppyName}'s Routine
        </button>
        <p className="text-xs text-muted-foreground">
          Tap anywhere to continue
        </p>
      </div>
    </div>
  );
}