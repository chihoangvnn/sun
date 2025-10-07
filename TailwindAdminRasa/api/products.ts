import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../server/storage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { id, landing } = req.query;
    
    // Handle product landing pages routes
    if (landing === 'true') {
      return handleLandingPages(req, res, id);
    }
    
    // Handle regular products API
    if (req.method === 'GET') {
      const { categoryId, withCategories, search } = req.query;
      
      if (withCategories === 'true') {
        const products = await storage.getProductsWithCategory(50, categoryId as string, search as string);
        res.json(products);
      } else {
        const products = await storage.getProducts(50, categoryId as string, search as string);
        res.json(products);
      }
    } else if (req.method === 'POST') {
      // Accept all fields from req.body and pass to storage
      const productData = {
        ...req.body,
        price: req.body.price?.toString(),
        itemCode: req.body.itemCode || null,
        categoryId: req.body.categoryId || null,
        stock: req.body.stock || 0,
        status: req.body.status || 'active',
        image: req.body.image || 'https://via.placeholder.com/300x300'
      };
      const product = await storage.createProduct(productData);
      res.json({ ...product, message: 'Product created successfully' });
    } else if (req.method === 'PUT' && id && typeof id === 'string') {
      // Accept all fields from req.body and pass to storage
      const productData = {
        ...req.body,
        price: req.body.price?.toString(),
      };
      const product = await storage.updateProduct(id, productData);
      if (product) {
        res.json({ ...product, message: 'Product updated successfully' });
      } else {
        res.status(404).json({ error: 'Product not found' });
      }
    } else if (req.method === 'DELETE') {
      console.log('🗑️ DELETE request received');
      console.log('📋 Query params:', req.query);
      console.log('🆔 ID from query:', id);
      
      if (!id || typeof id !== 'string') {
        console.error('❌ No valid ID provided for DELETE');
        return res.status(400).json({ error: 'Product ID is required for deletion' });
      }
      
      console.log('🔄 Attempting to delete product:', id);
      const success = await storage.deleteProduct(id);
      
      if (success) {
        console.log('✅ Product deleted successfully:', id);
        res.json({ message: 'Product deleted successfully', id });
      } else {
        console.log('❌ Product not found:', id);
        res.status(404).json({ error: 'Product not found' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Handle product landing pages functionality
async function handleLandingPages(req: VercelRequest, res: VercelResponse, id?: string | string[]) {
  try {
    // Handle specific ID routes
    if (id && typeof id === 'string') {
      
      if (req.method === 'GET') {
        // GET /api/products?landing=true&id=:id
        const products = await storage.getProducts(10);
        const product = products.find(p => p.id === id);
        
        if (!product) {
          return res.status(404).json({ error: "Landing page not found" });
        }

        const landingPage = {
          id: `demo-${product.id}`,
          title: `Landing Page - ${product.name}`,
          slug: `product-${product.id}`,
          description: product.description,
          productId: product.id,
          customPrice: parseFloat(product.price),
          heroTitle: `Mua ngay ${product.name}`,
          isActive: true,
          theme: 'light',
          primaryColor: '#007bff',
          contactInfo: {
            phone: '0123456789',
            email: 'contact@store.com',
            businessName: 'Cửa hàng Demo'
          },
          paymentMethods: {
            cod: true,
            bankTransfer: true,
            online: false
          },
          features: [`Sản phẩm ${product.name} chất lượng cao`, 'Giao hàng tận nơi', 'Đổi trả dễ dàng'],
          viewCount: Math.floor(Math.random() * 1000),
          orderCount: Math.floor(Math.random() * 50),
          conversionRate: (Math.random() * 10).toFixed(2)
        };
        
        res.json(landingPage);
        
      } else if (req.method === 'PUT') {
        // PUT /api/products?landing=true&id=:id
        console.log('Updating landing page:', id, req.body);
        res.json({ message: "Product landing page updated successfully (demo mode)" });
        
      } else if (req.method === 'DELETE') {
        // DELETE /api/products?landing=true&id=:id
        console.log('Deleting landing page:', id);
        res.json({ message: "Product landing page deleted successfully (demo mode)" });
        
      } else {
        res.status(405).json({ error: 'Method not allowed' });
      }
      
    } else {
      // Handle collection routes (no ID)
      
      if (req.method === 'GET') {
        // GET /api/products?landing=true (list all)
        const products = await storage.getProducts(50);
        const landingPages = products.map((product, index) => ({
          id: `demo-${product.id}`,
          title: `Landing Page - ${product.name}`,
          slug: `product-${product.id}`,
          description: product.description,
          productId: product.id,
          customPrice: parseFloat(product.price),
          heroTitle: `Mua ngay ${product.name}`,
          isActive: true,
          theme: 'light',
          primaryColor: '#007bff',
          contactInfo: {
            phone: '0123456789',
            email: 'contact@store.com',
            businessName: 'Cửa hàng Demo'
          },
          paymentMethods: {
            cod: true,
            bankTransfer: true,
            online: false
          },
          features: [`Sản phẩm ${product.name} chất lượng cao`, 'Giao hàng tận nơi', 'Đổi trả dễ dàng'],
          viewCount: Math.floor(Math.random() * 1000),
          orderCount: Math.floor(Math.random() * 50),
          conversionRate: (Math.random() * 10).toFixed(2)
        }));
        
        res.json(landingPages);
        
      } else if (req.method === 'POST') {
        // POST /api/products?landing=true (create new)
        const landingPageData = req.body;
        console.log('Creating landing page:', landingPageData);
        
        const demoId = `demo-${Date.now()}`;
        res.json({ id: demoId, message: "Product landing page created successfully (demo mode)" });
        
      } else {
        res.status(405).json({ error: 'Method not allowed' });
      }
    }
    
  } catch (error) {
    console.error('Product landing pages API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}