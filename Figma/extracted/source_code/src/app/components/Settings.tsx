import { useState } from "react";
import { ArrowLeft, Users, Share2, Copy, Check, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface SettingsProps {
  accountData: { name: string; email: string };
  puppyProfile: {
    name: string;
    breed: string;
    photoUrl: string;
    age: string;
    weight: string;
    livingSituation: string;
    workArrangement: string;
  };
  onBack: () => void;
}

export function Settings({ accountData, puppyProfile, onBack }: SettingsProps) {
  const [activeSection, setActiveSection] = useState<"main" | "caretakers" | "profile">("main");
  const [caretakers, setCaretakers] = useState<Array<{ name: string; email: string; addedDate: string }>>([
    // Mock caretaker data - in real app this would come from backend
  ]);
  const [inviteLink] = useState(`https://pupplan.app/join/${Math.random().toString(36).substr(2, 9)}`);
  const [copied, setCopied] = useState(false);

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveCaretaker = (email: string) => {
    setCaretakers(caretakers.filter(c => c.email !== email));
    toast.success("Caretaker removed");
  };

  if (activeSection === "caretakers") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-0">
        <div className="w-[390px] h-screen bg-background flex flex-col" style={{ paddingTop: '48px', paddingBottom: '34px' }}>
          {/* Header */}
          <div className="px-5 pb-4 flex items-center gap-3">
            <button
              onClick={() => setActiveSection("main")}
              className="text-primary hover:opacity-80 transition-opacity"
            >
              <ArrowLeft className="size-6" />
            </button>
            <h1 className="text-2xl font-bold text-foreground">Caretakers</h1>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 space-y-4">
            {/* Invite Section */}
            <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                  <Share2 className="size-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Invite a Caretaker</h3>
                  <p className="text-sm text-muted-foreground">Share routine tracking with family</p>
                </div>
              </div>
              <div className="bg-background rounded-xl p-3 mb-3">
                <p className="text-xs text-muted-foreground mb-1">Invite Link</p>
                <p className="text-sm text-foreground break-all">{inviteLink}</p>
              </div>
              <Button
                onClick={handleCopyInviteLink}
                className="w-full h-12 bg-primary hover:bg-[#D4661F] text-primary-foreground rounded-xl text-base font-semibold"
              >
                {copied ? (
                  <>
                    <Check className="size-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-4 mr-2" />
                    Copy Invite Link
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                You can have up to 1 caretaker. They can view and track activities but can't change settings.
              </p>
            </div>

            {/* Current Caretakers */}
            {caretakers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">
                  Current Caretakers ({caretakers.length}/1)
                </h3>
                {caretakers.map((caretaker, index) => (
                  <div
                    key={index}
                    className="bg-card rounded-2xl p-4 mb-3"
                    style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-foreground">{caretaker.name}</h4>
                        <p className="text-sm text-muted-foreground">{caretaker.email}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveCaretaker(caretaker.email)}
                        className="text-destructive text-sm font-medium hover:opacity-80 transition-opacity"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Added {caretaker.addedDate}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {caretakers.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                  <Users className="size-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No caretakers yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Share the invite link to add one
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === "profile") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-0">
        <div className="w-[390px] h-screen bg-background flex flex-col" style={{ paddingTop: '48px', paddingBottom: '34px' }}>
          {/* Header */}
          <div className="px-5 pb-4 flex items-center gap-3">
            <button
              onClick={() => setActiveSection("main")}
              className="text-primary hover:opacity-80 transition-opacity"
            >
              <ArrowLeft className="size-6" />
            </button>
            <h1 className="text-2xl font-bold text-foreground">Puppy Profile</h1>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 space-y-4">
            {/* Photo */}
            {puppyProfile.photoUrl && (
              <div className="flex justify-center">
                <img
                  src={puppyProfile.photoUrl}
                  alt={puppyProfile.name}
                  className="w-32 h-32 rounded-full object-cover"
                  style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}
                />
              </div>
            )}

            {/* Profile Info */}
            <div className="bg-card rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}>
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-base font-medium text-foreground">{puppyProfile.name}</p>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-sm text-muted-foreground">Breed</p>
                <p className="text-base font-medium text-foreground">{puppyProfile.breed}</p>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-sm text-muted-foreground">Age</p>
                <p className="text-base font-medium text-foreground">{puppyProfile.age}</p>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-sm text-muted-foreground">Weight</p>
                <p className="text-base font-medium text-foreground">{puppyProfile.weight}</p>
              </div>
            </div>

            {/* Living Details */}
            <div className="bg-card rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}>
              <div>
                <p className="text-sm text-muted-foreground">Living Situation</p>
                <p className="text-base font-medium text-foreground capitalize">{puppyProfile.livingSituation}</p>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-sm text-muted-foreground">Work Arrangement</p>
                <p className="text-base font-medium text-foreground capitalize">{puppyProfile.workArrangement}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center px-4">
              To update your puppy's information, please contact support
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main settings screen
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0">
      <div className="w-[390px] h-screen bg-background flex flex-col" style={{ paddingTop: '48px', paddingBottom: '34px' }}>
        {/* Header */}
        <div className="px-5 pb-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-primary hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="size-6" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 space-y-6">
          {/* Account Section */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">Account</h3>
            <div className="bg-card rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}>
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <p className="font-medium text-foreground">{accountData.name}</p>
                  <p className="text-sm text-muted-foreground">{accountData.email}</p>
                </div>
                <img 
                  src="https://images.unsplash.com/photo-1576558656222-ba66febe3dec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwxfHx8fDE3NzA3NTc5OTl8MA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                  style={{ border: '2px solid #E8E4E1' }}
                />
              </div>
            </div>
          </div>

          {/* Puppy Section */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">Puppy</h3>
            <button
              onClick={() => setActiveSection("profile")}
              className="w-full bg-card rounded-2xl p-4 flex items-center justify-between hover:bg-accent transition-colors"
              style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}
            >
              <div className="flex items-center gap-3">
                {puppyProfile.photoUrl ? (
                  <img
                    src={puppyProfile.photoUrl}
                    alt={puppyProfile.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-2xl">
                    🐶
                  </div>
                )}
                <div className="text-left">
                  <p className="font-medium text-foreground">{puppyProfile.name}</p>
                  <p className="text-sm text-muted-foreground">{puppyProfile.breed}</p>
                </div>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          </div>

          {/* Sharing Section */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">Sharing</h3>
            <button
              onClick={() => setActiveSection("caretakers")}
              className="w-full bg-card rounded-2xl p-4 flex items-center justify-between hover:bg-accent transition-colors"
              style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                  <Users className="size-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Caretakers</p>
                  <p className="text-sm text-muted-foreground">
                    {caretakers.length === 0 ? "None added" : `${caretakers.length} active`}
                  </p>
                </div>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          </div>

          {/* App Info */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">About</h3>
            <div className="bg-card rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="text-foreground font-medium">1.0.0</span>
              </div>
              <div className="border-t border-border pt-3">
                <button className="text-primary hover:opacity-80 transition-opacity">
                  Privacy Policy
                </button>
              </div>
              <div className="border-t border-border pt-3">
                <button className="text-primary hover:opacity-80 transition-opacity">
                  Terms of Service
                </button>
              </div>
            </div>
          </div>

          {/* Sign Out */}
          <div className="pb-4">
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl border-destructive text-destructive hover:bg-destructive/10"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}