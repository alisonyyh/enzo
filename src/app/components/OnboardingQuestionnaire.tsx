import { useState, useRef } from "react";
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

interface QuestionnaireData {
  puppyName: string;
  breed: string;
  photoUrl: string;
  photoFile: File | null;
  ageMonths: string;
  ageWeeks: string;
  weight: string;
  weightUnit: "lbs" | "kg";
  wakeUpTime: string;
  bedTime: string;
}

interface OnboardingQuestionnaireProps {
  onComplete: (data: QuestionnaireData) => void;
  /** Called when user taps back on step 1 (exits onboarding) */
  onBack?: () => void;
}

const DOG_BREEDS = [
  "Mixed/Unknown",
  "Labrador Retriever",
  "German Shepherd",
  "Golden Retriever",
  "French Bulldog",
  "Bulldog",
  "Poodle",
  "Beagle",
  "Rottweiler",
  "German Shorthaired Pointer",
  "Dachshund",
  "Pembroke Welsh Corgi",
  "Australian Shepherd",
  "Yorkshire Terrier",
  "Boxer",
  "Cavalier King Charles Spaniel",
  "Doberman Pinscher",
  "Great Dane",
  "Miniature Schnauzer",
  "Siberian Husky",
  "Bernese Mountain Dog",
  "Pomeranian",
  "Boston Terrier",
  "Havanese",
  "Shetland Sheepdog",
  "Brittany",
  "Shih Tzu",
  "Border Collie",
  "Cocker Spaniel",
  "Chihuahua"
].sort();

export function OnboardingQuestionnaire({ onComplete, onBack }: OnboardingQuestionnaireProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<QuestionnaireData>({
    puppyName: "",
    breed: "",
    photoUrl: "",
    photoFile: null,
    ageMonths: "",
    ageWeeks: "",
    weight: "",
    weightUnit: "lbs",
    wakeUpTime: "07:00",
    bedTime: "22:00",
  });

  const updateField = (field: keyof QuestionnaireData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Store the File object for Supabase upload
      setFormData((prev) => ({ ...prev, photoFile: file }));
      // Also create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        updateField("photoUrl", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.puppyName && formData.breed;
      case 2:
        const totalAge = parseInt(formData.ageMonths || "0") * 4 + parseInt(formData.ageWeeks || "0");
        return formData.ageMonths && formData.ageWeeks && parseInt(formData.ageMonths) >= 0 &&
               parseInt(formData.ageWeeks) >= 0 && totalAge > 0 && formData.weight;
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

  const progressSegments = Array.from({ length: totalSteps }, (_, i) => i < step);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0">
      <div className="w-[390px] h-screen bg-background flex flex-col" style={{ paddingTop: '48px', paddingBottom: '34px' }}>
        {/* Back Button — above progress bar on every step */}
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
            {step === 2 && "How old is your puppy?"}
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
                    onValueChange={(value) => updateField("breed", value)}
                  >
                    <SelectTrigger id="breed" className="h-12 rounded-2xl border-border bg-input-background">
                      <SelectValue placeholder="Select a breed" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOG_BREEDS.map((breed) => (
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ageMonths" className="text-sm text-muted-foreground mb-2 block font-normal">
                      Months *
                    </Label>
                    <Input
                      id="ageMonths"
                      type="number"
                      min="0"
                      placeholder="e.g., 3"
                      value={formData.ageMonths}
                      onChange={(e) => updateField("ageMonths", e.target.value)}
                      className="h-12 rounded-2xl border-border bg-input-background"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ageWeeks" className="text-sm text-muted-foreground mb-2 block font-normal">
                      Weeks *
                    </Label>
                    <Input
                      id="ageWeeks"
                      type="number"
                      min="0"
                      max="3"
                      placeholder="e.g., 2"
                      value={formData.ageWeeks}
                      onChange={(e) => updateField("ageWeeks", e.target.value)}
                      className="h-12 rounded-2xl border-border bg-input-background"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground -mt-2">
                  Enter total age (e.g., 3 months and 2 weeks)
                </p>
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
