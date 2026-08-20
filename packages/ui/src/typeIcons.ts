import type * as React from "react";
import {
  Activity, BookOpen, Briefcase, Building2, CalendarDays, Car, Coffee, Dumbbell, FileText, Film, Gamepad2, Gift, GraduationCap, Heart, Home, Landmark, LayoutTemplate,
  Lightbulb, MapPin, Music, Palette, PawPrint, Plane, Quote, Scissors, Sparkles, Star, Target, User, Users, Utensils, Wrench, PenLine, Feather,
} from "lucide-react";

/** Curated icon set for Document types (name → component). Built-ins pick from the same set; user-defined types store the name. */
export const TYPE_ICONS = {
  "file-text": FileText, user: User, users: Users, "map-pin": MapPin, "calendar-days": CalendarDays, "layout-template": LayoutTemplate,
  "book-open": BookOpen, briefcase: Briefcase, building: Building2, car: Car, coffee: Coffee, dumbbell: Dumbbell, film: Film, gamepad: Gamepad2,
  gift: Gift, "graduation-cap": GraduationCap, heart: Heart, home: Home, landmark: Landmark, lightbulb: Lightbulb, music: Music, palette: Palette,
  "paw-print": PawPrint, plane: Plane, quote: Quote, sparkles: Sparkles, star: Star, target: Target, utensils: Utensils, wrench: Wrench, activity: Activity,
  scissors: Scissors, "pen-line": PenLine, feather: Feather,
} as const;
export type TypeIconName = keyof typeof TYPE_ICONS;

export function typeIcon(name: string | undefined): React.ComponentType<{ className?: string }> {
  return (TYPE_ICONS as Record<string, React.ComponentType<{ className?: string }>>)[name ?? ""] ?? FileText;
}
