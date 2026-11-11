import type { DemoRole } from "@/domain/types/hr";
import {
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FileText,
  FolderOpen,
  GraduationCap,
  Home,
  BarChart3,
  Settings,
  Timer,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: DemoRole[];
  planned?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export const navigationGroups: NavGroup[] = [
  {
    id: "personnel",
    label: "Espace personnel",
    items: [
      { href: "/tableau-de-bord", label: "Tableau de bord", icon: Home },
      { href: "/profil", label: "Mon profil", icon: UserRound },
      { href: "/documents", label: "Mes documents", icon: FolderOpen },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    id: "temps",
    label: "Gestion du temps",
    items: [
      { href: "/conges", label: "Congés et absences", icon: CalendarDays },
      {
        href: "/absences",
        label: "Arrêts & absences spéciales",
        icon: ClipboardList,
      },
      { href: "/teletravail", label: "Télétravail", icon: Building2 },
      {
        href: "/temps-de-travail",
        label: "Temps de travail",
        icon: Timer,
        planned: true,
      },
      { href: "/calendrier", label: "Calendrier RH", icon: CalendarRange },
    ],
  },
  {
    id: "vie",
    label: "Vie professionnelle",
    items: [
      {
        href: "/notes-de-frais",
        label: "Frais professionnels",
        icon: Wallet,
        planned: true,
      },
      {
        href: "/remuneration",
        label: "Rémunération et avantages",
        icon: Briefcase,
        planned: true,
      },
      {
        href: "/entretiens",
        label: "Recrutement / entretiens",
        icon: ClipboardList,
      },
      {
        href: "/formations",
        label: "Formation",
        icon: GraduationCap,
        planned: true,
      },
      {
        href: "/mobilite",
        label: "Mobilité interne",
        icon: BookOpen,
        planned: true,
      },
    ],
  },
  {
    id: "organisation",
    label: "Organisation",
    items: [
      {
        href: "/annuaire",
        label: "Annuaire collaborateurs",
        icon: Users,
        roles: ["chef_de_projet", "admin_rh"],
      },
      {
        href: "/administration",
        label: "Administration RH",
        icon: FileText,
        roles: ["chef_de_projet", "admin_rh"],
      },
      {
        href: "/administration/documents",
        label: "Demandes de documents",
        icon: FolderOpen,
        roles: ["chef_de_projet", "admin_rh"],
      },
      {
        href: "/administration/rapports",
        label: "Reporting RH",
        icon: BarChart3,
        roles: ["chef_de_projet", "admin_rh"],
      },
      {
        href: "/administration/absences",
        label: "Arrêts / absences spéciales",
        icon: ClipboardList,
        roles: ["chef_de_projet", "admin_rh"],
      },
      {
        href: "/administration/droits-conges",
        label: "Droits à congés",
        icon: ClipboardList,
        roles: ["chef_de_projet", "admin_rh"],
      },
      {
        href: "/administration/import-collaborateurs",
        label: "Import des collaborateurs",
        icon: Users,
        roles: ["chef_de_projet", "admin_rh"],
      },
      { href: "/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

export function navigationGroupsForRole(role: DemoRole): NavGroup[] {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || item.roles.includes(role),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

/** Flat list for mobile / breadcrumbs. */
export function navigationForRole(role: DemoRole): NavItem[] {
  return navigationGroupsForRole(role).flatMap((g) => g.items);
}

export function findNavItem(pathname: string, role: DemoRole): NavItem | null {
  const items = navigationForRole(role);
  const matches = items.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (matches.length === 0) return null;
  // Préférer le href le plus spécifique (évite /administration pour /administration/rapports).
  return matches.sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}
