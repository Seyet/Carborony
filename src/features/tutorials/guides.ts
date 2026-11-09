export type TutorialStep = { title: string; description: string; tip: string }
export type ModuleGuide = {
  id: string
  path: string
  title: string
  permission: string
  steps: readonly TutorialStep[]
}

export const moduleGuides = [
  { id: "dashboard", path: "/app/dashboard", title: "Your business at a glance", permission: "dashboard.view", steps: [
    { title: "Start with the date range", description: "Choose the period you want to review. Sales, orders, expenses and estimated profit update together, with comparisons to the previous period.", tip: "Check the date range before comparing numbers." },
    { title: "Follow the money", description: "Sales totals include completed sales and eligible paid storefront orders. The sales chart shows the trend, and Top Products helps you spot your strongest sellers.", tip: "Profit is an estimate based on item costs and recorded expenses." },
    { title: "Know what needs attention", description: "Use the low-stock, out-of-stock and pending-order alerts to decide what to do next. Recent Transactions helps you review the latest activity.", tip: "Use the sidebar on desktop, or More on mobile, to open another module." },
  ] },
  { id: "sales", path: "/app/sales", title: "Record a sale", permission: "sales.view", steps: [
    { title: "Build the basket", description: "Find products in your catalogue and add the quantities being sold. Review the price and available stock before continuing.", tip: "Keeping catalogue prices and costs current makes your sales reports more useful." },
    { title: "Check the customer and payment", description: "Choose a customer when needed, review any discount, and select the payment method. Confirm the total with the customer.", tip: "Recording a payment method does not charge a customer's card." },
    { title: "Complete and share", description: "If your role allows it, complete the sale or create an invoice for payment later. You can find the resulting document in Sales history.", tip: "Review the basket before completing a sale; completed sales affect reporting and tracked stock." },
  ] },
  { id: "sales-history", path: "/app/sales/history", title: "Find your sales documents", permission: "sales.view", steps: [
    { title: "Find the right transaction", description: "Browse your sales and invoices, using the available filters to narrow the list.", tip: "Check the date, customer and document number together." },
    { title: "Review before sharing", description: "Open a transaction to check its items, totals and payment status. Download its receipt or invoice when you need a copy.", tip: "An invoice is a payment request; its existence does not mean it has been paid." },
  ] },
  { id: "catalogue", path: "/app/catalogue", title: "Build your product catalogue", permission: "products.view", steps: [
    { title: "Organize your products", description: "Browse products and categories to see what your business sells. If you manage products, add a clear name, price and category for each listing.", tip: "Start with a few products rather than your entire range." },
    { title: "Get the details right", description: "Use product details for images, costs and variations such as size or colour. Accurate costs help estimate profit.", tip: "Check each variation's price and stock before making it available." },
    { title: "Prepare for selling", description: "Review product availability and inventory tracking. Storefront visibility is managed separately in My Website.", tip: "A catalogue product is not automatically a published website listing." },
  ] },
  { id: "orders", path: "/app/orders", title: "Manage every order", permission: "sales.view", steps: [
    { title: "Review incoming orders", description: "Find orders from your storefront and other supported channels. Use the filters to focus on the orders that need attention.", tip: "Order status and payment status describe different things." },
    { title: "Check the details", description: "Open an order to review the buyer, items, delivery details and payment state before preparing it.", tip: "Resolve payment or inventory review warnings before fulfillment." },
    { title: "Keep customers moving", description: "If your role permits, update an order as it progresses. Keep its status aligned with what has actually happened.", tip: "Online payments must be verified; changing fulfillment status does not collect money." },
  ] },
  { id: "inventory", path: "/app/inventory", title: "Keep stock accurate", permission: "inventory.view", steps: [
    { title: "Check stock health", description: "Review available quantities and look for low-stock or out-of-stock products.", tip: "Set sensible reorder levels so shortages are easier to spot." },
    { title: "Record real stock changes", description: "If you can manage inventory, record restocks and adjustments with a reason. Check the product and quantity before saving.", tip: "Count physical stock before making an adjustment." },
    { title: "Review movements", description: "Use the stock movement history to understand changes from sales, restocks and corrections.", tip: "Avoid adjusting stock again for a sale that already recorded its inventory movement." },
  ] },
  { id: "customers", path: "/app/customers", title: "Know your customers", permission: "customers.view", steps: [
    { title: "Find a customer", description: "Search your customer list and use segments to focus on the people you want to review.", tip: "Search first to avoid creating duplicate customers." },
    { title: "Build a useful profile", description: "Open a profile to review contact details and purchase history. If permitted, keep details and notes up to date.", tip: "Store only customer information your business needs." },
  ] },
  { id: "expenses", path: "/app/expenses", title: "Track what the business spends", permission: "expenses.view", steps: [
    { title: "Review spending", description: "Use the expense list and filters to understand where money is going.", tip: "Expenses are part of your estimated profit calculations." },
    { title: "Keep a clear record", description: "If permitted, record an expense with the correct amount, category and date, and attach a receipt when available.", tip: "Check for an existing expense before recording the same receipt twice." },
  ] },
  { id: "reports", path: "/app/reports", title: "Turn your records into insights", permission: "reports.view", steps: [
    { title: "Choose a report", description: "Review sales, inventory, expenses or profit depending on the question you want to answer.", tip: "Start with a clear question, such as which products sell best." },
    { title: "Set a useful scope", description: "Choose your dates and available filters before reading the results.", tip: "Estimated profit depends on complete costs and expenses; it is not your bank balance." },
    { title: "Share the right view", description: "If your role includes export permission, download the report in an available format for your records or team.", tip: "Review filters before exporting business information." },
  ] },
  { id: "activity", path: "/app/activity", title: "See what changed", permission: "activity.view", steps: [
    { title: "Review workspace activity", description: "Browse recorded actions to understand recent changes in the business.", tip: "Use the available date and activity filters to narrow your search." },
    { title: "Add context", description: "Check who performed an action and when, then open the relevant module if you need to investigate further.", tip: "Activity history helps with review; it is not a way to undo changes." },
  ] },
  { id: "website", path: "/app/website", title: "Set up your storefront", permission: "settings.view", steps: [
    { title: "Make it yours", description: "Review your store's branding, banner and welcome copy. If permitted, customize them for your business.", tip: "Preview how the store looks on both phone and desktop." },
    { title: "Choose what to sell", description: "Select the products customers should see and check their photos, prices and availability.", tip: "Only make products visible when they are ready for customers." },
    { title: "Check checkout, then publish", description: "Review delivery, pickup and payment options before publishing and sharing the storefront link. Storefront orders appear in Orders.", tip: "Place a test order before promoting your store." },
  ] },
  { id: "instagram", path: "/app/marketing/instagram", title: "Bring Instagram into your catalogue", permission: "settings.view", steps: [
    { title: "Connect your account", description: "The business owner can connect an eligible Instagram Business or Creator account and approve the requested access.", tip: "Only connect an account your business is authorized to use." },
    { title: "Review imported suggestions", description: "Review available media and product suggestions. Check names, prices, categories and stock before approving an import.", tip: "Suggestions need your review; a social post is not automatically a published product." },
    { title: "Avoid duplicate products", description: "Attach a post to an existing product when appropriate, or approve a new product if your role allows it.", tip: "Social Posts, Campaigns and AI Content are coming soon." },
  ] },
  { id: "staff", path: "/app/staff", title: "Give your team the right access", permission: "staff.view", steps: [
    { title: "Review your team", description: "See who has access to the workspace and check their current roles.", tip: "Each team member should use their own account." },
    { title: "Invite with care", description: "If you manage staff, confirm the invitation email and choose the permissions the person needs for their work.", tip: "Give the smallest set of permissions needed, and review access when responsibilities change." },
  ] },
  { id: "settings", path: "/app/settings", title: "Keep your workspace configured", permission: "settings.view", steps: [
    { title: "Review business preferences", description: "Check business details, currency, timezone and regional formatting in the available settings sections.", tip: "Timezone settings affect the dates used in business reports." },
    { title: "Protect your account", description: "Use profile and security settings to keep your own details and password current.", tip: "Never share your password or one-time verification codes." },
    { title: "Check payment setup", description: "The business owner manages payout accounts. Verify the bank and account details before saving changes.", tip: "Only use a payout account authorized for your business." },
  ] },
] as const satisfies readonly ModuleGuide[]

export type TutorialModuleId = typeof moduleGuides[number]["id"]
export const tutorialModuleIds = moduleGuides.map(guide => guide.id) as [TutorialModuleId, ...TutorialModuleId[]]

export function getModuleGuide(pathname: string, permissions: readonly string[]): typeof moduleGuides[number] | undefined {
  return [...moduleGuides]
    .sort((a,b) => b.path.length-a.path.length)
    .find(guide => (pathname === guide.path || pathname.startsWith(`${guide.path}/`))
      && permissions.includes(guide.permission))
}

export type TutorialProgress = {
  automatic: boolean
  handledModules: string[]
}
