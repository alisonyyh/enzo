import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ArrowLeft, Upload } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { fetchBreedProfiles } from "../../lib/services/puppies";
import type { BreedProfile } from "../../lib/database.types";

export interface QuestionnaireData {
  puppyName: string;
  breed: string;
  photoUrl: string;
  photoFile: File | null;
  dateOfBirth: string;
  weight: string;
  weightUnit: "lbs" | "kg";
  wakeUpTime: string;
  bedTime: string;
  breedSize: string;
  energyLevel: string;
  isBrachycephalic: boolean;
}

interface OnboardingQuestionnaireProps {
  onComplete: (data: QuestionnaireData) => void;
  onBack?: () => void;
}

const FALLBACK_BREEDS = [
  "Australian Shepherd", "Beagle", "Bernese Mountain Dog", "Border Collie",
  "Boston Terrier", "Boxer", "Bulldog (English)", "Cavalier King Charles",
  "Chihuahua", "Cocker Spaniel", "Corgi (Pembroke Welsh)", "Dachshund",
  "Dalmatian", "Doberman Pinscher", "French Bulldog", "German Shepherd",
  "Golden Retriever", "Great Dane", "Havanese", "Husky (Siberian)",
  "Labrador Retriever", "Maltese", "Miniature Schnauzer", "Mixed/Unknown",
  "Pomeranian", "Poodle (Standard)", "Pug", "Rottweiler", "Shih Tzu",
  "Yorkshire Terrier",
].sort();

export function OnboardingQuestionnaire({ onComplete, onBack }: OnboardingQuestionnaireProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [breedProfiles, setBreedProfiles] = useState<BreedProfile[]>([]);
  const [breedsLoaded, setBreedsLoaded] = useState(false);

  useEffect(() => {
    fetchBreedProfiles().then((profiles) => {
      if (profiles.length > 0) {
        setBreedProfiles(profiles);
      }
      setBreedsLoaded(true);
    });
  }, []);

  const breedNames = breedProfiles.length > 0
    ? breedProfiles.map((b) => b.breed_name).sort()
    : FALLBACK_BREEDS;

  const [formData, setFormData] = useState<QuestionnaireData>({
    puppyName: "",
    breed: "",
    photoUrl: "",
    photoFile: null,
    dateOfBirth: "",
    weight: "",
    weightUnit: "lbs",
    wakeUpTime: "07:00",
    bedTime: "22:00",
    breedSize: "medium",
    energyLevel: "moderate",
    isBrachycephalic: false,
  });

  const updateField = (field: keyof QuestionnaireData, value: string | boolean | File | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleBreedChange = (breed: string) => {
    updateField("breed", breed);
    const profile = breedProfiles.find((b) => b.breed_name === breed);
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        breed,
        breedSize: profile.breed_size,
        energyLevel: profile.energy_level,
        isBrachycephalic: profile.is_brachycephalic,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        breed,
        breedSize: "medium",
        energyLevel: "moderate",
        isBrachycephalic: false,
      }));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, photoFile: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        updateField("photoUrl", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const isDobValid = () => {
    if (!formData.dateOfBirth) return false;
    const dob = new Date(formData.dateOfBirth + "T00:00:00");
    const now = new Date();
    if (dob > now) return false;
    const ageMs = now.getTime() - dob.getTime();
    const ageWeeks = ageMs / (7 * 24 * 60 * 60 * 1000);
    return ageWeeks >= 8;
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.puppyName && formData.breed;
      case 2:
        return isDobValid() && formData.weight;
      case 3:
        return formData.wakeUpTime && formData.bedTime;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete(formData);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      onBack?.();
    }
  };

  // Compute max date (today) and min date (2 years ago) for the date picker
  const today = new Date().toISOString().split("T")[0];
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const progressSegments = Array.from({ length: totalSteps }, (_, i) => i < step);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0">
      <div className="w-[390px] h-screen bg-background flex flex-col" style={{ paddingTop: '48px', paddingBottom: '34px' }}>
        {/* Back Button */}
        <div className="px-5 mb-3">
          <button
            onClick={handleBack}
            className="text-primary hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="size-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-5 mb-6">
          <div className="flex items-center gap-1.5">
            {progressSegments.map((filled, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  filled ? "bg-primary" : "bg-[#E8E0D8]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="px-5 mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            {step === 1 && "Tell us about your puppy"}
            {step === 2 && "When was your puppy born?"}
            {step === 3 && "Tell us about your schedule"}
          </h1>
        </div>

        {/* Form Content */}
        <div className="flex-1 px-5 overflow-y-auto">
          <div className="space-y-5">
            {step === 1 && (
              <>
                <div>
                  <Label htmlFor="puppyName" className="text-sm text-muted-foreground mb-2 block font-normal">
                    Puppy's name *
                  </Label>
                  <Input
                    id="puppyName"
                    placeholder="e.g., Max"
                    value={formData.puppyName}
                    onChange={(e) => updateField("puppyName", e.target.value)}
                    className="h-12 rounded-2xl border-border bg-input-background"
                  />
                </div>
                <div>
                  <Label htmlFor="breed" className="text-sm text-muted-foreground mb-2 block font-normal">
                    Breed *
                  </Label>
                  <Select
                    value={formData.breed}
                    onValueChange={handleBreedChange}
                  >
                    <SelectTrigger id="breed" className="h-12 rounded-2xl border-border bg-input-background">
                      <SelectValue placeholder={breedsLoaded ? "Select a breed" : "Loading breeds..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {breedNames.map((breed) => (
                        <SelectItem key={breed} value={breed}>
                          {breed}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block font-normal">
                    Upload a photo (optional)
                  </Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  {formData.photoUrl ? (
                    <div className="space-y-3 flex flex-col items-center">
                      <img
                        src={formData.photoUrl}
                        alt="Puppy"
                        className="w-40 h-40 object-cover rounded-full"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-12 rounded-2xl border-border"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Change Photo
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12 rounded-2xl border-border"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="size-4 mr-2" />
                      Choose from Library
                    </Button>
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <Label htmlFor="dateOfBirth" className="text-sm text-muted-foreground mb-2 block font-normal">
                    Date of birth *
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    min={twoYearsAgo}
                    max={today}
                    value={formData.dateOfBirth}
                    onChange={(e) => updateField("dateOfBirth", e.target.value)}
                    className="h-12 rounded-2xl border-border bg-input-background"
                  />
                </div>
                {formData.dateOfBirth && !isDobValid() && (
                  <p className="text-sm text-destructive -mt-2">
                    Puppy must be at least 8 weeks old
                  </p>
                )}
                <div>
                  <Label htmlFor="weight" className="text-sm text-muted-foreground mb-2 block font-normal">
                    Current weight *
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="weight"
                      type="number"
                      placeholder="e.g., 12"
                      value={formData.weight}
                      onChange={(e) => updateField("weight", e.target.value)}
                      className="flex-1 h-12 rounded-2xl border-border bg-input-background"
                    />
                    <Select
                      value={formData.weightUnit}
                      onValueChange={(value: "lbs" | "kg") => updateField("weightUnit", value)}
                    >
                      <SelectTrigger className="w-24 h-12 rounded-2xl border-border bg-input-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lbs">lbs</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wakeUpTime" className="text-sm text-muted-foreground mb-2 block font-normal">
                    Wake up time *
                  </Label>
                  <Input
                    id="wakeUpTime"
                    type="time"
                    value={formData.wakeUpTime}
                    onChange={(e) => updateField("wakeUpTime", e.target.value)}
                    className="h-12 rounded-2xl border-border bg-input-background"
                  />
                </div>
                <div>
                  <Label htmlFor="bedTime" className="text-sm text-muted-foreground mb-2 block font-normal">
                    Bed time *
                  </Label>
                  <Input
                    id="bedTime"
                    type="time"
                    value={formData.bedTime}
                    onChange={(e) => updateField("bedTime", e.target.value)}
                    className="h-12 rounded-2xl border-border bg-input-background"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Next Button */}
        <div className="px-5 pt-6">
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="w-full h-[50px] bg-primary hover:bg-[#D4661F] text-primary-foreground rounded-xl text-base font-semibold"
          >
            {step === totalSteps ? "Generate My Puppy's Routine" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
