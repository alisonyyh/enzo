import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Users, Copy, Check, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { getInviteCode } from "../../lib/services/invite-codes";
import { uploadUserAvatar, updateProfile } from "../../lib/services/auth";
import { supabase } from "../../lib/supabase";

interface SettingsProps {
  accountData: { name: string; email: string };
  avatarUrl: string | null;
  puppyProfile: {
    name: string;
    breed: string;
    photoUrl: string;
    age: string;
    weight: string;
    livingSituation: string;
    workArrangement: string;
  };
  puppyId: string;
  userId: string;
  userRole: 'owner' | 'caretaker';
  onBack: () => void;
  onSignOut: () => void;
  onAvatarUpdate: (newUrl: string) => void;
}

export function Settings({ accountData, avatarUrl, puppyProfile, puppyId, userId, userRole, onBack, onSignOut, onAvatarUpdate }: SettingsProps) {
  const [activeSection, setActiveSection] = useState<"main" | "caretakers" | "profile">("main");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [caretakerCount, setCaretakerCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load invite code and caretaker count on mount (owners only)
  useEffect(() => {
    if (userRole !== 'owner') return;

    getInviteCode(puppyId).then(setInviteCode).catch(console.error);

    supabase
      .from("puppy_memberships")
      .select("id", { count: "exact", head: true })
      .eq("puppy_id", puppyId)
      .eq("role", "caretaker")
      .eq("status", "active")
      .then(({ count }) => setCaretakerCount(count || 0));
  }, [puppyId, userRole]);

  const handleCopyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast.success("Invite code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected if needed
    e.target.value = "";

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("Photo must be under 5MB. Please choose a smaller image.");
      return;
    }

    setShowPhotoSheet(false);
    setUploadingAvatar(true);
    try {
      const newUrl = await uploadUserAvatar(userId, file);
      await updateProfile(userId, { avatar_url: newUrl });
      onAvatarUpdate(newUrl);
      toast.success("Profile photo updated");
    } catch (err) {
      console.error("Avatar upload failed:", err);
      toast.error("Couldn't update photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
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
            {/* Invite Code Section */}
            <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}>
              <p className="text-sm font-medium text-muted-foreground mb-2">Invite Code</p>
              {inviteCode ? (
                <div className="bg-background rounded-xl p-3 flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-foreground tracking-wide">{inviteCode}</span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 text-primary hover:opacity-80 transition-opacity px-2 py-1"
                  >
                    {copied ? (
                      <>
                        <Check className="size-4" />
                        <span className="text-sm font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" />
                        <span className="text-sm font-medium">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="bg-background rounded-xl p-3 mb-3">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground leading-relaxed">
                Share this code with someone you'd like to help care for {puppyProfile.name}. They can enter it when they sign up for PupPlan.
              </p>
            </div>

            {/* Current Caretakers */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">
                Current Caretakers
              </h3>
              {caretakerCount === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                    <Users className="size-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">None yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Share the invite code to add a caretaker
                  </p>
                </div>
              ) : (
                <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)' }}>
                  <p className="text-sm text-foreground">
                    {caretakerCount} caretaker{caretakerCount > 1 ? "s" : ""} active
                  </p>
                </div>
              )}
            </div>
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
      {/* Hidden file input — triggered programmatically from action sheet */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Photo source action sheet */}
      {showPhotoSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowPhotoSheet(false)}
        >
          <div
            className="w-full max-w-[390px] bg-card rounded-t-2xl pb-8 pt-2 px-4 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-4" />
            <p className="text-center font-semibold text-foreground mb-3">Change Profile Photo</p>
            <button
              className="w-full h-12 rounded-xl bg-accent text-foreground font-medium hover:opacity-80 transition-opacity"
              onClick={() => {
                // Web doesn't have a native camera picker separate from file input,
                // so we use capture="user" to hint the camera on mobile.
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute("capture", "user");
                  fileInputRef.current.click();
                }
              }}
            >
              Take a Photo
            </button>
            <button
              className="w-full h-12 rounded-xl bg-accent text-foreground font-medium hover:opacity-80 transition-opacity"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute("capture");
                  fileInputRef.current.click();
                }
              }}
            >
              Choose from Photo Library
            </button>
            <button
              className="w-full h-12 rounded-xl text-destructive font-medium hover:opacity-80 transition-opacity"
              onClick={() => setShowPhotoSheet(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
                {/* Left: user info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <p className="font-medium text-foreground">{accountData.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{accountData.email}</p>
                </div>
                {/* Right: avatar + Edit button */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  {/* Avatar */}
                  <div
                    className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-accent flex-shrink-0 relative"
                    style={{ border: '2px solid #E8E4E1' }}
                  >
                    {uploadingAvatar ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                        <svg className="animate-spin size-6 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      </div>
                    ) : null}
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={accountData.name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-3xl font-semibold text-foreground">
                        {accountData.name?.charAt(0)?.toUpperCase() || '👤'}
                      </span>
                    )}
                  </div>
                  {/* Edit button */}
                  <button
                    onClick={() => setShowPhotoSheet(true)}
                    disabled={uploadingAvatar}
                    className="text-xs font-semibold text-primary hover:opacity-70 transition-opacity disabled:opacity-40"
                  >
                    {uploadingAvatar ? "Updating..." : "Edit"}
                  </button>
                </div>
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

          {/* Sharing Section — owners only */}
          {userRole === 'owner' && (
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
                      {caretakerCount === 0 ? "None added" : `${caretakerCount} active`}
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" />
              </button>
            </div>
          )}

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
              onClick={onSignOut}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
