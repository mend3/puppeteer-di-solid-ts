# **Puppeteer Web Crawler with Dependency Injection and SOLID Principles**

This project implements a structured **web crawler** using **Puppeteer** and **TypeScript**, with a design that follows **SOLID principles** and **dependency injection** to ensure scalability, maintainability, and testability.

## **🔧 Key Architectural Concepts**

### **1. Dependency Injection (DI)**

- Instead of hardcoding service and listener instances, the **BrowserManager** dynamically **injects dependencies** from a **service registry**.
- This improves modularity, allowing services and listeners to be replaced or extended without modifying the core **BrowserManager**.

### **2. SOLID Principles in Action**

#### **Single Responsibility Principle (SRP)**

Each class is designed to handle a single aspect of crawling:

- **NavigationService** → Handles navigation logic.
- **ScrollService** → Manages page scrolling.
- **MetricsService** → Collects performance metrics.
- **PaginationService** → Extracts pagination links.
- **ContentService** → Scrapes page content.
- **ScreenshotService** → Takes screenshots of pages.
- **CookiesService** → Manages cookies for session persistence.

#### **Open/Closed Principle (OCP)**

- The `serviceRegistry` enables **new services** to be added **without modifying** the core class.
- New functionalities can be introduced by adding new service classes instead of altering existing logic.

#### **Liskov Substitution Principle (LSP)**

- Services in `serviceRegistry` **extend** a common base interface.
- Any new service can be used interchangeably **without breaking the existing workflow**.

#### **Interface Segregation Principle (ISP)**

- **Separate interfaces** for different functionalities:  
  - `StateHandler` → Handles state management.
  - `PageListener` → Attaches event listeners.
- Components **only depend on the methods they use**, preventing unnecessary dependencies.

#### **Dependency Inversion Principle (DIP)**

- **High-level modules (e.g., `BrowserManager`) do not depend on low-level modules (e.g., `NavigationService`).**  
- Instead, they rely on **abstract registries**, making the architecture **flexible** and **extensible**.

---

## **🛠️ Core Components & Patterns Used**

### **1. Registry Pattern**

Instead of manually instantiating services and listeners, the **registries (`serviceRegistry` and `listenersRegistry`) manage dependencies dynamically**. This centralizes dependency management and makes it easy to add new services.

```typescript
const serviceRegistry = {
  NavigationService,
  ScrollService,
  CookiesService,
  ClickService,
  MetricsService,
  PaginationService,
  ScreenshotService,
  ContentService,
} as const;
```

**Benefits:**
✅ Avoids unnecessary object instantiations.  
✅ Provides a **single source of truth** for all services.  
✅ Enables easy **service injection** via `BrowserManager.get()`.

---

### **2. Factory Pattern for Service Instantiation**

The `get()` and `listen()` methods act as **factories**, returning instances of the requested service or listener.

```typescript
get<T extends keyof typeof serviceRegistry>(name: T) {
  const ServiceClass = serviceRegistry[name];
  if (!ServiceClass) throw new Error(`Service '${name}' not found`);
  return new ServiceClass(this.page, this._state);
}

listen<T extends keyof typeof listenersRegistry>(name: T) {
  const ListenerClass = listenersRegistry[name];
  if (!ListenerClass) throw new Error(`Listener '${name}' not found`);
  return new ListenerClass(this.page, this._state);
}
```

**Benefits:**
✅ Decouples **service creation** from business logic.  
✅ Allows easy **service swapping** without modifying the core.  

---

### **3. Observer Pattern for Event Listeners**

The **listenersRegistry** manages request/response interceptors, which are dynamically attached to the Puppeteer `Page`.

```typescript
const listenersRegistry = {
  RequestInterceptorListener,
  ResponseInterceptorListener,
} as const;
```

```typescript
for (const instance of allListeners.filter(filterRequestListeners)) {
  await instance.onInitialize();
}
```

**Benefits:**
✅ **Efficient event handling** without modifying Puppeteer’s core.  
✅ Easy to **add/remove listeners** dynamically.

---

## **🚀 Execution Flow**

### **Step 1: Initialize Browser & Services**

1. The `BrowserManager` **launches Puppeteer** and creates a new page.
2. It attaches **request/response interceptors**.
3. Loads stored **cookies**.

---

### **Step 2: Perform Crawling Operations**

The crawler dynamically retrieves services and executes tasks.

```typescript
const navigation = browserManager.get("NavigationService");
await navigation.navigate("https://www.myjob.mu/...");

const cookies = browserManager.get("CookiesService");
await cookies.loadCookiesFromStorage(outputPath);
```

---

### **Step 3: Extract Data**

```typescript
await browserManager.get("PaginationService").discover();
await browserManager.get("MetricsService").getResults();
await browserManager.get("ContentService").getContent();
```

---

### **Step 4: Capture Screenshot & Save Data**

```typescript
await browserManager.get("ScreenshotService").screenshot(screenshotPath);
await browserManager.exportState(outputPath);
```

---

### **Step 5: Cleanup**

```typescript
await browserManager.close();
```

---

## **📌 Key Takeaways**

✅ **Highly modular & extensible** → New services and listeners can be added without modifying core logic.  
✅ **Dependency Injection & SOLID Principles** → Improves maintainability and testability.  
✅ **Registry & Factory Patterns** → Simplifies service management and instantiation.  
✅ **Observer Pattern for event listening** → Efficiently handles Puppeteer events.  

This design ensures **scalability, separation of concerns, and flexibility** in web crawling.
