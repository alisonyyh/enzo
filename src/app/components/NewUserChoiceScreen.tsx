import { Users, PawPrint } from "lucide-react";

interface NewUserChoiceScreenProps {
  onHasInviteCode: () => void;
  onNoInviteCode: () => void;
}

export function NewUserChoiceScreen({ onHasInviteCode, onNoInviteCode }: NewUserChoiceScreenProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0">
      <div
        className="w-[390px] h-screen bg-background flex flex-col"
        style={{ paddingTop: "48px", paddingBottom: "34px" }}
      >
        {/* Header area */}
        <div className="flex flex-col items-center px-5 pt-12 pb-4">
          <div className="text-[80px] leading-none mb-4">🐶</div>
          <h1 className="text-[28px] font-bold text-foreground mb-2">Welcome to PupPlan!</h1>
          <p className="text-base text-muted-foreground text-center">
            How would you like to get started?
          </p>
        </div>

        {/* Choice cards */}
        <div className="flex flex-col gap-3 px-5 mt-6">
          {/* Option 1: I have an invite code */}
          <button
            onClick={onHasInviteCode}
            className="w-full bg-card rounded-2xl p-5 text-left transition-all active:scale-[0.98] border border-border hover:border-primary hover:bg-[rgba(232,114,42,0.04)]"
            style={{ boxShadow: "0 2px 8px rgba(45, 27, 14, 0.06)" }}
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-[rgba(232,114,42,0.10)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-foreground mb-1">
                  I have an invite code
                </h3>
                <p className="text-sm text-muted-foreground leading-snug">
                  Join someone else's puppy routine as a caretaker
                </p>
              </div>
            </div>
          </button>

          {/* Option 2: I do not have an invite code */}
          <button
            onClick={onNoInviteCode}
            className="w-full bg-card rounded-2xl p-5 text-left transition-all active:scale-[0.98] border border-border hover:border-primary hover:bg-[rgba(232,114,42,0.04)]"
            style={{ boxShadow: "0 2px 8px rgba(45, 27, 14, 0.06)" }}
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-[rgba(232,114,42,0.10)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <PawPrint className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-foreground mb-1">
                  I do not have an invite code
                </h3>
                <p className="text-sm text-muted-foreground leading-snug">
                  Set up a new puppy routine as a primary owner
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
