import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Eye, MoreHorizontal, Search, Filter, Plus, Edit, Trash2, Store, ShoppingBag, Zap, UserPlus, RefreshCw } from "lucide-react";
import { useResponsive, useTouchFriendly } from "@/hooks/use-mobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { OrderForm } from "./OrderForm";
import { useNewOrderNotification } from "./NewOrderNotification";
import { formatOrderId, getShortOrderId, isMarketplaceOrder, createOrderDisplayInfo } from "@/utils/orderUtils";
import type { Order } from "@shared/schema";

interface OrderWithCustomerInfo extends Order {
  customerName: string;
  customerEmail: string;
  sourceInfo?: {
    source: 'admin' | 'storefront' | 'tiktok-shop' | 'landing-page' | 'pos' | 'chatbot';
    sourceOrderId: string | null;
    sourceReference: string | null;
    syncStatus: 'synced' | 'pending' | 'failed' | 'manual';
  };
}

interface OrderTableProps {
  onViewOrder?: (order: OrderWithCustomerInfo) => void;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(price);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('vi-VN');
};

// Helper function to get status labels
const getStatusLabel = (status: string) => {
  const labels = {
    pending: "Chờ xử lý",
    processing: "Đang xử lý", 
    shipped: "Đã gửi",
    delivered: "Hoàn thành",
    cancelled: "Đã hủy"
  };
  return labels[status as keyof typeof labels] || status;
};

// 🎨 Enhanced Status Badge với colors và icons
const getStatusBadge = (status: string) => {
  const statusConfig = {
    pending: { 
      label: "🟡 Chờ xử lý", 
      variant: "outline" as const,
      className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
    },
    processing: { 
      label: "🔵 Đang xử lý", 
      variant: "outline" as const,
      className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
    },
    shipped: { 
      label: "🟢 Đã gửi", 
      variant: "outline" as const,
      className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
    },
    delivered: { 
      label: "✅ Hoàn thành", 
      variant: "outline" as const,
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
    },
    cancelled: { 
      label: "🔴 Đã hủy", 
      variant: "outline" as const,
      className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig];
  return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
};

// 🔄 Status Update Button Component
const getStatusUpdateButton = (order: OrderWithCustomerInfo, onUpdateStatus: (orderId: string, newStatus: string) => void, isUpdating: boolean = false) => {
  const statusFlow = {
    pending: { 
      nextStatus: "processing", 
      buttonText: "Xử lý",
      icon: "🔵",
      className: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
    },
    processing: { 
      nextStatus: "shipped", 
      buttonText: "Gửi hàng",
      icon: "🚚",
      className: "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
    },
    shipped: { 
      nextStatus: "delivered", 
      buttonText: "Hoàn thành",
      icon: "✅",
      className: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
    }
  };

  const config = statusFlow[order.status as keyof typeof statusFlow];
  
  // If no next status available, show disabled completed state
  if (!config) {
    return (
      <Button size="sm" variant="outline" disabled className="bg-gray-50 text-gray-500">
        {order.status === 'delivered' ? '✅ Hoàn thành' : '🔴 Đã hủy'}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline" 
      disabled={isUpdating}
      onClick={() => onUpdateStatus(order.id, config.nextStatus)}
      className={`${config.className} transition-all duration-200`}
      title={`Chuyển sang: ${getStatusLabel(config.nextStatus)}`}
    >
      {isUpdating ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        <>
          {config.icon} {config.buttonText}
        </>
      )}
    </Button>
  );
};

// 🎨 Enhanced Source Badge Component với Brand Colors
const getSourceBadge = (sourceInfo: OrderWithCustomerInfo['sourceInfo']) => {
  const defaultBadge = (
    <Badge className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100">
      ⚙️ Admin
    </Badge>
  );
  
  if (!sourceInfo) return defaultBadge;
  
  const sourceConfig = {
    admin: { 
      label: "⚙️ Admin", 
      className: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
    },
    storefront: { 
      label: "🏪 Storefront", 
      className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
    },
    'tiktok-shop': { 
      label: "🎵 TikTok Shop", 
      className: "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200 font-semibold"
    },
    'landing-page': { 
      label: "🔗 Landing Page", 
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
    },
    pos: { 
      label: "💳 POS", 
      className: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
    },
    chatbot: { 
      label: "🤖 Chatbot", 
      className: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100 font-medium"
    }
  };

  const config = sourceConfig[sourceInfo.source] || sourceConfig.admin;
  
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
};

// 🔄 Sync Status Badge Component  
const getSyncStatusBadge = (syncStatus?: string) => {
  if (!syncStatus || syncStatus === 'manual') return null;
  
  const syncConfig = {
    synced: { label: "Đã đồng bộ", variant: "default" as const, color: "text-green-600" },
    pending: { label: "Đang đồng bộ", variant: "secondary" as const, color: "text-yellow-600" },
    failed: { label: "Lỗi đồng bộ", variant: "destructive" as const, color: "text-red-600" }
  };

  const config = syncConfig[syncStatus as keyof typeof syncConfig];
  if (!config) return null;
  
  return (
    <Badge variant={config.variant} className="flex items-center gap-1 text-xs">
      <RefreshCw className={`h-2 w-2 ${config.color}`} />
      {config.label}
    </Badge>
  );
};

export function OrderTable({ onViewOrder }: OrderTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [syncStatusFilter, setSyncStatusFilter] = useState<string>("all");
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderWithCustomerInfo | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<OrderWithCustomerInfo | null>(null);
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 🌿 Gentle Green Notifications for Main Orders
  const { triggerNewOrderNotification, NewOrderNotificationComponent } = useNewOrderNotification();
  
  // 📱 Enhanced responsive design hooks
  const { isMobile, isTablet, deviceType } = useResponsive();
  const { touchButtonSize, minTouchTarget, touchPadding, touchGap } = useTouchFriendly();

  // 🚀 Enhanced Orders Query with Source Filtering
  const { data: orders = [], isLoading, error } = useQuery<OrderWithCustomerInfo[]>({
    queryKey: ["/api/orders", sourceFilter, syncStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sourceFilter && sourceFilter !== 'all') {
        params.set('source', sourceFilter);
      }
      if (syncStatusFilter && syncStatusFilter !== 'all') {
        params.set('syncStatus', syncStatusFilter);
      }
      
      const response = await apiRequest('GET', `/api/orders?${params.toString()}`);
      return response.json();
    },
    refetchInterval: 30000, // Check for new orders every 30 seconds
  });

  // 🌿 New Order Detection for Main Orders (Robust)
  useEffect(() => {
    if (orders?.length > 0) {
      // Only process notifications when no search/filter applied (clean state)
      const isCleanState = searchTerm === "" && statusFilter === "all";
      
      if (!isCleanState) return;
      
      // Get persistent state for main orders
      const lastSeenKey = `lastSeenMainOrder`;
      const seenIdsKey = `seenMainOrderIds`;
      
      const lastSeenTimestamp = localStorage.getItem(lastSeenKey);
      const lastSeen = lastSeenTimestamp ? new Date(lastSeenTimestamp) : null;
      
      const seenIdsJson = localStorage.getItem(seenIdsKey);
      const seenIds = new Set<string>(seenIdsJson ? JSON.parse(seenIdsJson) : []);
      
      // Initialize baseline on first load to prevent deadlock
      if (!lastSeen) {
        const newestOrderDate = orders[0].createdAt ? new Date(orders[0].createdAt) : new Date();
        localStorage.setItem(lastSeenKey, newestOrderDate.toISOString());
        // Add all current order IDs to seen set to prevent immediate notifications
        orders.forEach((order: OrderWithCustomerInfo) => seenIds.add(order.id));
        localStorage.setItem(seenIdsKey, JSON.stringify(Array.from(seenIds)));
        return; // Skip notifications on initialization
      }
      
      // Find truly new orders (after last seen time AND not in seen IDs)
      const newOrders = orders.filter((order: OrderWithCustomerInfo) => {
        if (!lastSeen || !order.createdAt) return false; // Safety guard
        const orderDate = new Date(order.createdAt);
        return orderDate > lastSeen && !seenIds.has(order.id);
      });
      
      // Process each new order sequentially with stagger (max 20 to avoid spam)
      const notifyOrders = newOrders.slice(0, 20);
      const remainingCount = newOrders.length - notifyOrders.length;
      
      notifyOrders.forEach((order: OrderWithCustomerInfo, index: number) => {
        setTimeout(() => {
          // Calculate time ago
          const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
          const now = new Date();
          const diffInMinutes = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60));
          
          let timeAgo = 'Vừa xong';
          if (diffInMinutes >= 1 && diffInMinutes < 60) {
            timeAgo = `${diffInMinutes} phút trước`;
          } else if (diffInMinutes >= 60) {
            const hours = Math.floor(diffInMinutes / 60);
            timeAgo = `${hours} giờ trước`;
          }
          
          // Trigger gentle green notification for main order
          triggerNewOrderNotification({
            id: order.id,
            orderNumber: formatOrderId(order),
            customerName: order.customerName,
            totalAmount: Number(order.total),
            currency: 'VND',
            itemCount: typeof order.items === 'number' ? order.items : 1,
            timeAgo
          });
          
          // Add to seen IDs
          seenIds.add(order.id);
        }, index * 800); // Stagger by 800ms
      });
      
      // Show summary notification if too many new orders
      if (remainingCount > 0) {
        setTimeout(() => {
          toast({
            variant: 'gentle-success',
            title: `+${remainingCount} Đơn Hàng Mới Khác`,
            description: 'Có nhiều đơn hàng mới vừa đến cùng lúc'
          });
        }, notifyOrders.length * 800 + 400);
      }
      
      // Update persistent state (burst-safe lastSeen advancement)
      if (newOrders.length > 0) {
        // Only advance lastSeen if there's no potential truncation
        const pageIsFull = orders.length >= 25; // Assuming pagination limit
        const potentialTruncation = remainingCount > 0 || (pageIsFull && newOrders.length >= 25);
        
        if (!potentialTruncation) {
          // Safe to advance lastSeen - all new orders are on this page
          const maxNotifiedDate = Math.max(...notifyOrders.map(o => o.createdAt ? new Date(o.createdAt).getTime() : 0));
          const currentLastSeen = lastSeen || new Date(0);
          const newLastSeen = new Date(Math.max(maxNotifiedDate, currentLastSeen.getTime()));
          localStorage.setItem(lastSeenKey, newLastSeen.toISOString());
        }
        // If truncation detected, rely on seenIds for deduplication without advancing lastSeen
      }
      
      // Always update seen IDs to maintain LRU cache
      if (orders.length > 0) {
        // Add all notified order IDs to seen set 
        notifyOrders.forEach((order: OrderWithCustomerInfo) => seenIds.add(order.id));
        
        // Prune seenIds to maintain LRU with 500 limit
        const seenIdsArray = Array.from(seenIds);
        const prunedSeenIds = seenIdsArray.slice(-500);
        localStorage.setItem(seenIdsKey, JSON.stringify(prunedSeenIds));
      }
    }
  }, [orders, searchTerm, statusFilter, triggerNewOrderNotification, toast]);

  // 🚀 Enhanced Filtering with Source & Sync Status
  const filteredOrders = orders.filter(order => {
    const matchesSearch = (order.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (order.customerEmail || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesSource = sourceFilter === "all" || (order.sourceInfo?.source || 'admin') === sourceFilter;
    const matchesSyncStatus = syncStatusFilter === "all" || (order.sourceInfo?.syncStatus || 'manual') === syncStatusFilter;
    return matchesSearch && matchesStatus && matchesSource && matchesSyncStatus;
  });

  // Delete order mutation
  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest('DELETE', `/api/orders/${orderId}`);
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đơn hàng đã được xóa",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setDeletingOrder(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      const response = await apiRequest('PUT', `/api/orders/${orderId}/status`, {
        status: newStatus
      });
      return response.json();
    },
    onSuccess: (data, { orderId, newStatus }) => {
      toast({
        title: "Cập nhật thành công",
        description: `Đơn hàng đã chuyển sang trạng thái: ${getStatusLabel(newStatus)}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi cập nhật trạng thái",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleViewOrder = (order: OrderWithCustomerInfo) => {
    setLocation(`/orders/${order.id}`);
  };

  const handleEditOrder = (order: OrderWithCustomerInfo) => {
    setEditingOrder(order);
  };

  const handleDeleteOrder = (order: OrderWithCustomerInfo) => {
    setDeletingOrder(order);
  };

  const handleUpdateStatus = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, newStatus });
  };

  const confirmDelete = () => {
    if (deletingOrder) {
      deleteMutation.mutate(deletingOrder.id);
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="order-table">
        <CardHeader>
          <CardTitle>Đơn hàng gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="order-table">
        <CardHeader>
          <CardTitle>Đơn hàng gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Không thể tải dữ liệu đơn hàng</p>
        </CardContent>
      </Card>
    );
  }


  return (
    <div className="space-y-6">
      {/* 🌿 Gentle Green Notifications for Main Orders */}
      <NewOrderNotificationComponent />
      

      <Card data-testid="order-table">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Đơn hàng gần đây</CardTitle>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Button 
              onClick={() => setIsCreateFormOpen(true)}
              data-testid="button-create-order"
              className="md:order-last"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tạo đơn hàng
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="orders-search"
                name="orders-search"
                placeholder="Tìm kiếm đơn hàng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 md:w-64"
                data-testid="input-search-orders"
              />
            </div>
            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="button-filter-status">
                  <Filter className="h-4 w-4 mr-2" />
                  {statusFilter === "all" ? "Tất cả trạng thái" : getStatusBadge(statusFilter).props.children}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  Tất cả trạng thái
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>
                  Chờ xử lý
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("processing")}>
                  Đang xử lý
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("shipped")}>
                  Đã gửi
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("delivered")}>
                  Đã giao
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("cancelled")}>
                  Đã hủy
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 🚀 Source Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="button-filter-source">
                  <Store className="h-4 w-4 mr-2" />
                  {sourceFilter === "all" ? "Tất cả nguồn" : (() => {
                    const sourceLabels = {
                      admin: "Admin", 
                      storefront: "Storefront",
                      'tiktok-shop': "TikTok Shop",
                      'landing-page': "Landing Page"
                    };
                    return sourceLabels[sourceFilter as keyof typeof sourceLabels] || sourceFilter;
                  })()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSourceFilter("all")}>
                  Tất cả nguồn
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSourceFilter("admin")}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Admin
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSourceFilter("storefront")}>
                  <Store className="h-4 w-4 mr-2" />
                  Storefront
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSourceFilter("tiktok-shop")}>
                  <Zap className="h-4 w-4 mr-2" />
                  TikTok Shop
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSourceFilter("landing-page")}>
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Landing Page
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 🔄 Sync Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="button-filter-sync">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {syncStatusFilter === "all" ? "Tất cả sync" : (() => {
                    const syncLabels = {
                      manual: "Thủ công",
                      synced: "Đã đồng bộ", 
                      pending: "Đang đồng bộ",
                      failed: "Lỗi đồng bộ"
                    };
                    return syncLabels[syncStatusFilter as keyof typeof syncLabels] || syncStatusFilter;
                  })()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSyncStatusFilter("all")}>
                  Tất cả sync
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSyncStatusFilter("manual")}>
                  Thủ công
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSyncStatusFilter("synced")}>
                  Đã đồng bộ
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSyncStatusFilter("pending")}>
                  Đang đồng bộ
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSyncStatusFilter("failed")}>
                  Lỗi đồng bộ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 📱 Mobile-First Responsive Rendering */}
        {isMobile ? (
          /* 📱 MOBILE CARD LAYOUT - Touch-Friendly Design */
          <div className={`space-y-4 ${touchGap}`}>
            {filteredOrders.map((order, index) => {
              
              return (
                <div
                  key={order.id}
                  className={`activity-card relative overflow-hidden ${touchPadding} space-y-4`}
                  data-testid={`mobile-order-card-${order.id}`}
                >
                  {/* Background gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--activity-teal))]/5 via-transparent to-[hsl(var(--activity-mint))]/5 pointer-events-none" />
                  
                  {/* Header với Order ID và Status */}
                  <div className="relative flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-col">
                        <span className="font-mono text-lg font-bold text-[hsl(var(--activity-teal))]">#{formatOrderId(order)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSourceBadge(order.sourceInfo)}
                        {getSyncStatusBadge(order.sourceInfo?.syncStatus)}
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                  
                  {/* Customer Info */}
                  <div className="relative bg-surface/30 rounded-xl p-4 border border-border/50">
                    <h4 className="font-bold text-foreground mb-1">{order.customerName}</h4>
                    <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
                  </div>
                  
                  {/* Order Details Grid */}
                  <div className="relative grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-muted-foreground">Ngày đặt</span>
                      <div className="text-base font-semibold">
                        {order.createdAt ? formatDate(order.createdAt.toString()) : 'N/A'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-muted-foreground">Sản phẩm</span>
                      <div className="text-base font-semibold text-[hsl(var(--activity-pink))]">
                        {Array.isArray(order.items) ? order.items.length : typeof order.items === 'number' ? order.items : 1} sản phẩm
                      </div>
                    </div>
                  </div>
                  
                  {/* Total và Actions */}
                  <div className="relative flex items-center justify-between pt-4 border-t border-border/50">
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-muted-foreground">Tổng tiền</span>
                      <div className="text-xl font-bold text-[hsl(var(--activity-mint))]">
                        {formatPrice(Number(order.total))}
                      </div>
                    </div>
                    
                    {/* Touch-Friendly Action Buttons */}
                    <div className="flex items-center gap-3">
                      {/* Status Update Button for Mobile */}
                      <div className={touchButtonSize}>
                        {getStatusUpdateButton(order, handleUpdateStatus, updateStatusMutation.isPending && updateStatusMutation.variables?.orderId === order.id)}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewOrder(order)}
                        className={`${touchButtonSize} ${minTouchTarget} text-[hsl(var(--activity-teal))] border-[hsl(var(--activity-teal))]/30 hover:bg-[hsl(var(--activity-teal))]/10`}
                        data-testid={`mobile-view-order-${order.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Xem
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="outline"
                            size="sm"
                            className={`${touchButtonSize} ${minTouchTarget} border-border/50 hover:border-[hsl(var(--activity-purple))]/30`}
                            data-testid={`mobile-order-actions-${order.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-48">
                          <DropdownMenuItem 
                            onClick={() => handleEditOrder(order)}
                            className="text-base py-3"
                          >
                            <Edit className="h-4 w-4 mr-3" />
                            Chỉnh sửa đơn hàng
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteOrder(order)}
                            className="text-destructive focus:text-destructive text-base py-3"
                          >
                            <Trash2 className="h-4 w-4 mr-3" />
                            Xóa đơn hàng
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 💻 DESKTOP TABLE LAYOUT - Traditional Table Design */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn hàng</TableHead>
                <TableHead className="w-32">Cập nhật</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Nguồn</TableHead>
                <TableHead>Ngày đặt</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Tổng tiền</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order, index) => {
                
                return (
                  <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                    <TableCell className="font-medium" data-testid={`order-id-${order.id}`}>
                      <span className="font-mono text-sm font-semibold text-blue-600">#{formatOrderId(order)}</span>
                    </TableCell>
                    <TableCell data-testid={`order-update-button-${order.id}`}>
                      {getStatusUpdateButton(order, handleUpdateStatus, updateStatusMutation.isPending && updateStatusMutation.variables?.orderId === order.id)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-sm text-muted-foreground">{order.customerEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`order-source-${order.id}`}>
                      <div className="flex flex-col gap-1">
                        {getSourceBadge(order.sourceInfo)}
                        {getSyncStatusBadge(order.sourceInfo?.syncStatus)}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`order-date-${order.id}`}>
                      {order.createdAt ? formatDate(order.createdAt.toString()) : 'N/A'}
                    </TableCell>
                    <TableCell data-testid={`order-items-${order.id}`}>
                      {Array.isArray(order.items) ? order.items.length : typeof order.items === 'number' ? order.items : 1} sản phẩm
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`order-total-${order.id}`}>
                      {formatPrice(Number(order.total))}
                    </TableCell>
                    <TableCell data-testid={`order-status-${order.id}`}>
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Desktop Action Buttons */}
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewOrder(order)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                          data-testid={`view-order-${order.id}`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Xem
                        </Button>
                        
                        <Button
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditOrder(order)}
                          className="text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                          data-testid={`edit-order-${order.id}`}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Sửa
                        </Button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-gray-400 hover:text-gray-600"
                              data-testid={`order-more-actions-${order.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleDeleteOrder(order)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Xóa đơn hàng
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {filteredOrders.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {orders.length === 0 ? "Chưa có đơn hàng nào" : "Không tìm thấy đơn hàng nào."}
            </p>
          </div>
        )}
      </CardContent>

      {/* Create Order Form */}
      {isCreateFormOpen && (
        <OrderForm
          onClose={() => setIsCreateFormOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          }}
        />
      )}

      {/* Edit Order Form */}
      {editingOrder && (
        <OrderForm
          order={editingOrder as any}
          onClose={() => setEditingOrder(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingOrder} onOpenChange={() => setDeletingOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa đơn hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa đơn hàng #{deletingOrder ? formatOrderId(deletingOrder) : ''} của khách hàng {deletingOrder?.customerName} không? 
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa đơn hàng'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
    </div>
  );
}