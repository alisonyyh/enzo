import { Button } from "./ui/button";
import type { PuppyJoinData } from "./InviteCodeEntryScreen";

interface InviteCodeSuccessScreenProps {
  puppyData: PuppyJoinData;
  onViewRoutine: () => void;
}

export function InviteCodeSuccessScreen({ puppyData, onViewRoutine }: InviteCodeSuccessScreenProps) {
  const ageDisplay = puppyData.ageWeeks >= 8
    ? `${Math.floor(puppyData.ageWeeks / 4)} months`
    : `${puppyData.ageWeeks} weeks`;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0">
      <div
        className="w-[390px] h-screen bg-background flex flex-col items-center justify-center"
        style={{ paddingTop: "48px", paddingBottom: "34px" }}
      >
        <div className="flex flex-col items-center px-5 w-full">
          {/* Celebration emoji */}
          <div className="text-[64px] leading-none mb-4">🎉</div>

          {/* Heading */}
          <h1 className="text-[28px] font-bold text-foreground mb-6">You're in!</h1>

          {/* Puppy card */}
          <div
            className="w-full bg-card rounded-2xl p-6 border border-border mb-8"
            style={{ boxShadow: "0 2px 8px rgba(45, 27, 14, 0.06)" }}
          >
            {/* Puppy photo or fallback */}
            <div className="flex justify-center mb-4">
              {puppyData.photoUrl ? (
                <img
                  src={puppyData.photoUrl}
                  alt={puppyData.puppyName}
                  className="w-20 h-20 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[rgba(232,114,42,0.10)] flex items-center justify-center text-[40px]">
                  🐶
                </div>
              )}
            </div>

            <p className="text-center text-base text-foreground mb-4">
              You've joined as a caretaker for{" "}
              <span className="font-semibold">{puppyData.puppyName}</span>!
            </p>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Breed</span>
                <span className="text-foreground font-medium">{puppyData.breed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Age</span>
                <span className="text-foreground font-medium">{ageDisplay}</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center mt-4 leading-relaxed">
              You can view {puppyData.puppyName}'s daily routine and mark activities as complete.
            </p>
          </div>

          {/* View Routine button */}
          <Button
            onClick={onViewRoutine}
            className="w-full h-[50px] rounded-xl text-base font-medium"
          >
            View Routine
          </Button>
        </div>
      </div>
    </div>
  );
}
