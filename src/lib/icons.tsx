import {
  Banknote,
  Car,
  Gamepad2,
  HeartPulse,
  Home,
  PiggyBank,
  Plane,
  Shirt,
  ShoppingCart,
  Tag,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  banknote: Banknote,
  'piggy-bank': PiggyBank,
  'shopping-cart': ShoppingCart,
  home: Home,
  zap: Zap,
  car: Car,
  utensils: UtensilsCrossed,
  'gamepad-2': Gamepad2,
  'heart-pulse': HeartPulse,
  shirt: Shirt,
  plane: Plane,
  tag: Tag,
}

export function CategoryIcon({
  icon,
  className,
}: {
  icon: string
  className?: string
}) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag
  return <Icon className={className} />
}
