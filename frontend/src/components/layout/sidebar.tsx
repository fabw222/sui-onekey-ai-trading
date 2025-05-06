import type React from "react"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Wallet, TrendingUp, BarChart2, Globe, Settings, Download } from "lucide-react"

type NavItem = {
  name: string
  icon: React.ReactNode
  href: string
}

export type NavItemType = "Home" | "Trade" | "Earn" | "Market" | "Browser" | "Settings" | "Download"

interface SidebarProps {
  onNavigate?: (item: NavItemType) => void
  activeItem?: NavItemType
}

export default function Sidebar({ onNavigate, activeItem: propActiveItem }: SidebarProps) {
  const [localActiveItem, setLocalActiveItem] = useState<NavItemType>("Home")
  
  // Use the activeItem provided in props or the local state
  const activeItem = propActiveItem || localActiveItem

  const topNavItems: NavItem[] = [
    { name: "Home", icon: <Wallet size={18} />, href: "#" },
    { name: "Earn", icon: <TrendingUp size={18} />, href: "#" },
    { name: "Trade", icon: <BarChart2 size={18} />, href: "#" },
    { name: "Market", icon: <BarChart2 size={18} />, href: "#" },
    { name: "Browser", icon: <Globe size={18} />, href: "#" },
  ]

  const bottomNavItems: NavItem[] = [
    { name: "Settings", icon: <Settings size={18} />, href: "#" },
    { name: "Download", icon: <Download size={18} />, href: "#" },
  ]

  const handleItemClick = (itemName: NavItemType) => {
    setLocalActiveItem(itemName)
    if (onNavigate) {
      onNavigate(itemName)
    }
  }

  return (
    <div className="w-[155px] min-h-screen border-r border-gray-200 flex flex-col justify-between bg-gray-50">
      <div className="flex flex-col">
        {topNavItems.map((item) => (
          <NavItem
            key={item.name}
            item={item}
            isActive={activeItem === item.name}
            onClick={() => handleItemClick(item.name as NavItemType)}
          />
        ))}
      </div>

      <div className="flex flex-col">
        {bottomNavItems.map((item) => (
          <NavItem
            key={item.name}
            item={item}
            isActive={activeItem === item.name}
            onClick={() => handleItemClick(item.name as NavItemType)}
          />
        ))}

        <div className="p-4 bg-gray-100 m-2 rounded-md">
          <h3 className="font-medium text-sm">OneKey AI+</h3>
          <p className="text-xs text-gray-600 mt-1">Utilizing artificial intelligence to provide smart trading analysis for your crypto assets</p>
        </div>
      </div>
    </div>
  )
}

function NavItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  onClick: () => void
}) {
  return (
    <a
      href={item.href}
      className={cn(
        "flex items-center px-4 py-3 text-sm transition-colors",
        isActive ? "bg-gray-200 font-medium" : "text-gray-700 hover:bg-gray-100",
      )}
      onClick={(e) => {
        e.preventDefault()
        onClick()
      }}
    >
      <span className="mr-3">{item.icon}</span>
      {item.name}
    </a>
  )
}

