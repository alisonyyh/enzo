import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface InviteCodeEntryScreenProps {
  onBack: () => void;
  onSubmit: (code: string) => Promise<{ success: boolean; error?: string; puppyData?: PuppyJoinData }>;
  onSuccess: (puppyData: PuppyJoinData) => void;
}

export interface PuppyJoinData {
  puppyName: string;
  breed: string;
  ageWeeks: number;
  photoUrl: string | null;
}

export function InviteCodeEntryScreen({ onBack, onSubmit, onSuccess }: InviteCodeEntryScreenProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedCode = code.trim();
  const canSubmit = trimmedCode.length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await onSubmit(trimmedCode.toUpperCase());
      if (result.success && result.puppyData) {
        onSuccess(result.puppyData);
      } else if (!result.success) {
        setError(
          result.error ||
            "That code doesn't match any household. Please check with the puppy's owner and try again."
        );
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSubmit) {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0">
      <div
        className="w-[390px] h-screen bg-background flex flex-col"
        style={{ paddingTop: "48px", paddingBottom: "34px" }}
      >
        {/* Back button */}
        <div className="px-5 pt-3 pb-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors -ml-1"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col px-5 pt-8">
          <h1 className="text-[24px] font-bold text-foreground mb-2">
            Enter your invite code
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            Ask the puppy's owner for their invite code. You can find it in their app under Settings &gt; Caretakers.
          </p>

          {/* Invite code input */}
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="e.g. BISCUIT-7X2K"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              onKeyDown={handleKeyDown}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={`h-12 rounded-2xl text-base tracking-wide font-medium ${
                error
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }`}
            />
            {error && (
              <p className="text-sm text-destructive leading-snug px-1">
                {error}
              </p>
            )}
          </div>

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full h-[50px] mt-6 rounded-xl text-base font-medium"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating...
              </span>
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
