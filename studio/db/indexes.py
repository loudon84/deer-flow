from studio.db.collections import get_collection


async def ensure_indexes() -> None:
    """确保所有索引已创建"""
    templates = get_collection("article_templates")
    template_versions = get_collection("article_template_versions")
    jobs = get_collection("article_jobs")
    documents = get_collection("article_documents")
    approvals = get_collection("article_approvals")
    ragflow_tasks = get_collection("article_ragflow_tasks")
    runtime_sessions = get_collection("portal_runtime_sessions")
    runtime_events = get_collection("portal_runtime_events")
    hitl_actions = get_collection("portal_hitl_actions")

    # article_templates 索引
    await templates.create_index("code", unique=True)
    await templates.create_index("status")
    await templates.create_index("category")
    await templates.create_index("updatedAt")

    # article_template_versions 索引
    await template_versions.create_index(
        [("templateId", 1), ("version", -1)],
        unique=True,
    )

    # article_jobs 索引
    await jobs.create_index("status")
    await jobs.create_index("userId")
    await jobs.create_index("templateId")
    await jobs.create_index("createdAt")

    # article_documents 索引
    await documents.create_index("jobId")
    await documents.create_index("templateId")
    await documents.create_index("approvalStatus")
    await documents.create_index("ragflowStatus")
    await documents.create_index("updatedAt")

    # article_approvals 索引
    await approvals.create_index("documentId")
    await approvals.create_index("status")
    await approvals.create_index("createdAt")

    # article_ragflow_tasks 索引
    await ragflow_tasks.create_index("status")
    await ragflow_tasks.create_index(
        [("documentId", 1), ("documentVersion", 1)],
    )
    await ragflow_tasks.create_index("createdAt")

    # portal_runtime_sessions 索引
    await runtime_sessions.create_index([("ownerType", 1), ("ownerId", 1), ("createdAt", -1)])
    await runtime_sessions.create_index("threadId", unique=True)
    await runtime_sessions.create_index([("userId", 1), ("updatedAt", -1)])
    await runtime_sessions.create_index([("status", 1), ("updatedAt", -1)])

    # portal_runtime_events 索引
    await runtime_events.create_index([("sessionId", 1), ("seq", 1)], unique=True)
    await runtime_events.create_index([("ownerType", 1), ("ownerId", 1), ("seq", 1)])
    await runtime_events.create_index([("threadId", 1), ("seq", 1)])
    await runtime_events.create_index([("eventType", 1), ("createdAt", -1)])

    # portal_hitl_actions 索引
    await hitl_actions.create_index([("sessionId", 1), ("createdAt", -1)])
    await hitl_actions.create_index([("ownerType", 1), ("ownerId", 1), ("createdAt", -1)])
    await hitl_actions.create_index([("operatorId", 1), ("createdAt", -1)])
