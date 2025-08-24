class ApiResponse {
  constructor(statusCode, data, message = "Success", meta = null) {
    this.statusCode = statusCode;
    this.status = statusCode < 400 ? "success" : "error";
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();

    // إضافة معلومات إضافية إذا كانت متوفرة
    if (meta) {
      this.meta = meta;
    }

    // إضافة معرف فريد للاستجابة للتتبع
    this.requestId = this.generateRequestId();
  }

  // توليد معرف فريد للطلب
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // إنشاء استجابة نجاح
  static success(
    data,
    message = "Operation completed successfully",
    statusCode = 200,
    meta = null
  ) {
    return new ApiResponse(statusCode, data, message, meta);
  }

  // إنشاء استجابة إنشاء ناجح
  static created(data, message = "Resource created successfully", meta = null) {
    return new ApiResponse(201, data, message, meta);
  }

  // إنشاء استجابة قبول
  static accepted(data, message = "Request accepted", meta = null) {
    return new ApiResponse(202, data, message, meta);
  }

  // إنشاء استجابة بدون محتوى
  static noContent(message = "No content") {
    return new ApiResponse(204, null, message);
  }

  // إنشاء استجابة مع بيانات مقسمة (pagination)
  static paginated(data, pagination, message = "Data retrieved successfully") {
    const meta = {
      pagination: {
        currentPage: pagination.page || 1,
        totalPages: pagination.pages || 1,
        totalItems: pagination.total || 0,
        itemsPerPage: pagination.limit || 10,
        hasNextPage: (pagination.page || 1) < (pagination.pages || 1),
        hasPrevPage: (pagination.page || 1) > 1,
      },
    };

    return new ApiResponse(200, data, message, meta);
  }

  // إنشاء استجابة مع إحصائيات
  static withStats(
    data,
    stats,
    message = "Data with statistics retrieved successfully"
  ) {
    const meta = { stats };
    return new ApiResponse(200, data, message, meta);
  }

  // إنشاء استجابة مع معلومات الملف المرفوع
  static fileUploaded(fileData, message = "File uploaded successfully") {
    const meta = {
      file: {
        originalName: fileData.originalName,
        fileName: fileData.fileName,
        size: fileData.size,
        mimeType: fileData.mimeType,
        uploadedAt: new Date().toISOString(),
      },
    };

    return new ApiResponse(201, fileData, message, meta);
  }

  // إنشاء استجابة للعمليات المجمعة (bulk operations)
  static bulk(results, message = "Bulk operation completed") {
    const meta = {
      bulk: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        details: results,
      },
    };

    return new ApiResponse(200, results, message, meta);
  }

  // إنشاء استجابة للبحث
  static searchResults(
    data,
    searchMeta,
    message = "Search completed successfully"
  ) {
    const meta = {
      search: {
        query: searchMeta.query,
        totalResults: searchMeta.total,
        searchTime: searchMeta.searchTime,
        filters: searchMeta.filters || {},
        suggestions: searchMeta.suggestions || [],
      },
      pagination: searchMeta.pagination,
    };

    return new ApiResponse(200, data, message, meta);
  }

  // إنشاء استجابة للتحليلات والتقارير
  static analytics(
    data,
    period,
    message = "Analytics data retrieved successfully"
  ) {
    const meta = {
      analytics: {
        period: period,
        generatedAt: new Date().toISOString(),
        dataPoints: Array.isArray(data)
          ? data.length
          : Object.keys(data).length,
      },
    };

    return new ApiResponse(200, data, message, meta);
  }

  // إنشاء استجابة للعمليات غير المتزامنة
  static async(jobId, message = "Job started successfully") {
    const meta = {
      async: {
        jobId: jobId,
        status: "pending",
        startedAt: new Date().toISOString(),
        estimatedCompletion: null,
      },
    };

    return new ApiResponse(202, { jobId }, message, meta);
  }

  // إنشاء استجابة للتحديثات الجزئية
  static partialUpdate(
    data,
    updatedFields,
    message = "Resource partially updated"
  ) {
    const meta = {
      update: {
        fieldsUpdated: updatedFields,
        updatedAt: new Date().toISOString(),
      },
    };

    return new ApiResponse(200, data, message, meta);
  }

  // إنشاء استجابة مع تحذيرات
  static withWarnings(
    data,
    warnings,
    message = "Operation completed with warnings"
  ) {
    const meta = {
      warnings: warnings.map((warning) => ({
        code: warning.code,
        message: warning.message,
        field: warning.field || null,
      })),
    };

    return new ApiResponse(200, data, message, meta);
  }

  // إنشاء استجابة للتصدير
  static export(data, exportInfo, message = "Export completed successfully") {
    const meta = {
      export: {
        format: exportInfo.format,
        fileName: exportInfo.fileName,
        size: exportInfo.size,
        recordCount: exportInfo.recordCount,
        exportedAt: new Date().toISOString(),
      },
    };

    return new ApiResponse(200, data, message, meta);
  }

  // تحويل الاستجابة إلى JSON مع تنسيق محدد
  toJSON() {
    const response = {
      status: this.status,
      statusCode: this.statusCode,
      message: this.message,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };

    // إضافة البيانات إذا كانت موجودة
    if (this.data !== null && this.data !== undefined) {
      response.data = this.data;
    }

    // إضافة المعلومات الإضافية إذا كانت موجودة
    if (this.meta) {
      response.meta = this.meta;
    }

    return response;
  }

  // إرسال الاستجابة مع Express
  send(res) {
    return res.status(this.statusCode).json(this.toJSON());
  }

  // إضافة معلومات إضافية للاستجابة
  addMeta(key, value) {
    if (!this.meta) {
      this.meta = {};
    }
    this.meta[key] = value;
    return this;
  }

  // إضافة رابط للموارد ذات الصلة
  addLinks(links) {
    if (!this.meta) {
      this.meta = {};
    }
    this.meta.links = links;
    return this;
  }

  // إضافة معلومات الأداء
  addPerformance(startTime) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    if (!this.meta) {
      this.meta = {};
    }

    this.meta.performance = {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };

    return this;
  }

  // إضافة معلومات التخزين المؤقت
  addCacheInfo(cacheStatus, ttl = null) {
    if (!this.meta) {
      this.meta = {};
    }

    this.meta.cache = {
      status: cacheStatus, // 'hit', 'miss', 'bypass'
      ttl: ttl,
      cachedAt: cacheStatus === "hit" ? new Date().toISOString() : null,
    };

    return this;
  }

  // إضافة معلومات الأمان
  addSecurityInfo(permissions = []) {
    if (!this.meta) {
      this.meta = {};
    }

    this.meta.security = {
      permissions: permissions,
      accessLevel: this.determineAccessLevel(permissions),
    };

    return this;
  }

  // تحديد مستوى الوصول بناءً على الصلاحيات
  determineAccessLevel(permissions) {
    if (permissions.includes("admin") || permissions.includes("master")) {
      return "full";
    } else if (permissions.includes("write")) {
      return "write";
    } else if (permissions.includes("read")) {
      return "read";
    }
    return "none";
  }
}

module.exports = ApiResponse;
