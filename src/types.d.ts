import { z } from 'zod';
export declare const BlockSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["text", "image", "drawing", "quote", "checklist"]>;
    content: z.ZodString;
    author: z.ZodEnum<["AI", "自"]>;
    notes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["text", "image", "drawing", "quote", "url"]>;
        content: z.ZodString;
        timestamp: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "text" | "image" | "drawing" | "quote" | "url";
        content: string;
        timestamp: number;
    }, {
        id: string;
        type: "text" | "image" | "drawing" | "quote" | "url";
        content: string;
        timestamp: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "text" | "image" | "drawing" | "quote" | "checklist";
    content: string;
    author: "AI" | "自";
    notes: {
        id: string;
        type: "text" | "image" | "drawing" | "quote" | "url";
        content: string;
        timestamp: number;
    }[];
}, {
    id: string;
    type: "text" | "image" | "drawing" | "quote" | "checklist";
    content: string;
    author: "AI" | "自";
    notes?: {
        id: string;
        type: "text" | "image" | "drawing" | "quote" | "url";
        content: string;
        timestamp: number;
    }[] | undefined;
}>;
export declare const SectionSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    goal: z.ZodString;
    status: z.ZodEnum<["未作成", "AIの下書き", "書き込みあり", "完了"]>;
    done: z.ZodDefault<z.ZodBoolean>;
    review: z.ZodDefault<z.ZodBoolean>;
    blocks: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["text", "image", "drawing", "quote", "checklist"]>;
        content: z.ZodString;
        author: z.ZodEnum<["AI", "自"]>;
        notes: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodEnum<["text", "image", "drawing", "quote", "url"]>;
            content: z.ZodString;
            timestamp: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            id: string;
            type: "text" | "image" | "drawing" | "quote" | "url";
            content: string;
            timestamp: number;
        }, {
            id: string;
            type: "text" | "image" | "drawing" | "quote" | "url";
            content: string;
            timestamp: number;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "text" | "image" | "drawing" | "quote" | "checklist";
        content: string;
        author: "AI" | "自";
        notes: {
            id: string;
            type: "text" | "image" | "drawing" | "quote" | "url";
            content: string;
            timestamp: number;
        }[];
    }, {
        id: string;
        type: "text" | "image" | "drawing" | "quote" | "checklist";
        content: string;
        author: "AI" | "自";
        notes?: {
            id: string;
            type: "text" | "image" | "drawing" | "quote" | "url";
            content: string;
            timestamp: number;
        }[] | undefined;
    }>, "many">>;
    hints: z.ZodDefault<z.ZodArray<z.ZodObject<{
        query: z.ZodString;
        sources: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
            title: string;
        }, {
            url: string;
            title: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        query: string;
        sources: {
            url: string;
            title: string;
        }[];
    }, {
        query: string;
        sources: {
            url: string;
            title: string;
        }[];
    }>, "many">>;
    checklist: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        text: z.ZodString;
        checked: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        text: string;
        checked: boolean;
    }, {
        id: string;
        text: string;
        checked?: boolean | undefined;
    }>, "many">>;
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "未作成" | "AIの下書き" | "書き込みあり" | "完了";
    checklist: {
        id: string;
        text: string;
        checked: boolean;
    }[];
    title: string;
    goal: string;
    done: boolean;
    review: boolean;
    blocks: {
        id: string;
        type: "text" | "image" | "drawing" | "quote" | "checklist";
        content: string;
        author: "AI" | "自";
        notes: {
            id: string;
            type: "text" | "image" | "drawing" | "quote" | "url";
            content: string;
            timestamp: number;
        }[];
    }[];
    hints: {
        query: string;
        sources: {
            url: string;
            title: string;
        }[];
    }[];
    updatedAt: number;
}, {
    id: string;
    status: "未作成" | "AIの下書き" | "書き込みあり" | "完了";
    title: string;
    goal: string;
    updatedAt: number;
    checklist?: {
        id: string;
        text: string;
        checked?: boolean | undefined;
    }[] | undefined;
    done?: boolean | undefined;
    review?: boolean | undefined;
    blocks?: {
        id: string;
        type: "text" | "image" | "drawing" | "quote" | "checklist";
        content: string;
        author: "AI" | "自";
        notes?: {
            id: string;
            type: "text" | "image" | "drawing" | "quote" | "url";
            content: string;
            timestamp: number;
        }[] | undefined;
    }[] | undefined;
    hints?: {
        query: string;
        sources: {
            url: string;
            title: string;
        }[];
    }[] | undefined;
}>;
export declare const ChapterSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    sections: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        goal: z.ZodString;
        status: z.ZodEnum<["未作成", "AIの下書き", "書き込みあり", "完了"]>;
        done: z.ZodDefault<z.ZodBoolean>;
        review: z.ZodDefault<z.ZodBoolean>;
        blocks: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodEnum<["text", "image", "drawing", "quote", "checklist"]>;
            content: z.ZodString;
            author: z.ZodEnum<["AI", "自"]>;
            notes: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["text", "image", "drawing", "quote", "url"]>;
                content: z.ZodString;
                timestamp: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "url";
                content: string;
                timestamp: number;
            }, {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "url";
                content: string;
                timestamp: number;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            type: "text" | "image" | "drawing" | "quote" | "checklist";
            content: string;
            author: "AI" | "自";
            notes: {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "url";
                content: string;
                timestamp: number;
            }[];
        }, {
            id: string;
            type: "text" | "image" | "drawing" | "quote" | "checklist";
            content: string;
            author: "AI" | "自";
            notes?: {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "url";
                content: string;
                timestamp: number;
            }[] | undefined;
        }>, "many">>;
        hints: z.ZodDefault<z.ZodArray<z.ZodObject<{
            query: z.ZodString;
            sources: z.ZodArray<z.ZodObject<{
                title: z.ZodString;
                url: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                url: string;
                title: string;
            }, {
                url: string;
                title: string;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            query: string;
            sources: {
                url: string;
                title: string;
            }[];
        }, {
            query: string;
            sources: {
                url: string;
                title: string;
            }[];
        }>, "many">>;
        checklist: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            text: z.ZodString;
            checked: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            text: string;
            checked: boolean;
        }, {
            id: string;
            text: string;
            checked?: boolean | undefined;
        }>, "many">>;
        updatedAt: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "未作成" | "AIの下書き" | "書き込みあり" | "完了";
        checklist: {
            id: string;
            text: string;
            checked: boolean;
        }[];
        title: string;
        goal: string;
        done: boolean;
        review: boolean;
        blocks: {
            id: string;
            type: "text" | "image" | "drawing" | "quote" | "checklist";
            content: string;
            author: "AI" | "自";
            notes: {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "url";
                content: string;
                timestamp: number;
            }[];
        }[];
        hints: {
            query: string;
            sources: {
                url: string;
                title: string;
            }[];
        }[];
        updatedAt: number;
    }, {
        id: string;
        status: "未作成" | "AIの下書き" | "書き込みあり" | "完了";
        title: string;
        goal: string;
        updatedAt: number;
        checklist?: {
            id: string;
            text: string;
            checked?: boolean | undefined;
        }[] | undefined;
        done?: boolean | undefined;
        review?: boolean | undefined;
        blocks?: {
            id: string;
            type: "text" | "image" | "drawing" | "quote" | "checklist";
            content: string;
            author: "AI" | "自";
            notes?: {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "url";
                content: string;
                timestamp: number;
            }[] | undefined;
        }[] | undefined;
        hints?: {
            query: string;
            sources: {
                url: string;
                title: string;
            }[];
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    sections: {
        id: string;
        status: "未作成" | "AIの下書き" | "書き込みあり" | "完了";
        checklist: {
            id: string;
            text: string;
            checked: boolean;
        }[];
        title: string;
        goal: string;
        done: boolean;
        review: boolean;
        blocks: {
            id: string;
            type: "text" | "image" | "drawing" | "quote" | "checklist";
            content: string;
            author: "AI" | "自";
            notes: {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "url";
                content: string;
                timestamp: number;
            }[];
        }[];
        hints: {
            query: string;
            sources: {
                url: string;
                title: string;
            }[];
        }[];
        updatedAt: number;
    }[];
}, {
    id: string;
    title: string;
    sections: {
        id: string;
        status: "未作成" | "AIの下書き" | "書き込みあり" | "完了";
        title: string;
        goal: string;
        updatedAt: number;
        checklist?: {
            id: string;
            text: string;
            checked?: boolean | undefined;
        }[] | undefined;
        done?: boolean | undefined;
        review?: boolean | undefined;
        blocks?: {
            id: string;
            type: "text" | "image" | "drawing" | "quote" | "checklist";
            content: string;
            author: "AI" | "自";
            notes?: {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "url";
                content: string;
                timestamp: number;
            }[] | undefined;
        }[] | undefined;
        hints?: {
            query: string;
            sources: {
                url: string;
                title: string;
            }[];
        }[] | undefined;
    }[];
}>;
export declare const TextbookSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    goal: z.ZodString;
    context: z.ZodString;
    chapters: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        sections: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            goal: z.ZodString;
            status: z.ZodEnum<["未作成", "AIの下書き", "書き込みあり", "完了"]>;
            done: z.ZodDefault<z.ZodBoolean>;
            review: z.ZodDefault<z.ZodBoolean>;
            blocks: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                type: z.ZodEnum<["text", "image", "drawing", "quote", "checklist"]>;
                content: z.ZodString;
                author: z.ZodEnum<["AI", "自"]>;
                notes: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    type: z.ZodEnum<["text", "image", "drawing", "quote", "url"]>;
                    content: z.ZodString;
                    timestamp: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    id: string;
                    type: "text" | "image" | "drawing" | "quote" | "url";
                    content: string;
                    timestamp: number;
                }, {
                    id: string;
                    type: "text" | "image" | "drawing" | "quote" | "url";
                    content: string;
                    timestamp: number;
                }>, "many">>;
            }, "strip", z.ZodTypeAny, {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "checklist";
                content: string;
                author: "AI" | "自";
                notes: {
                    id: string;
                    type: "text" | "image" | "drawing" | "quote" | "url";
                    content: string;
                    timestamp: number;
                }[];
            }, {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "checklist";
                content: string;
                author: "AI" | "自";
                notes?: {
                    id: string;
                    type: "text" | "image" | "drawing" | "quote" | "url";
                    content: string;
                    timestamp: number;
                }[] | undefined;
            }>, "many">>;
            hints: z.ZodDefault<z.ZodArray<z.ZodObject<{
                query: z.ZodString;
                sources: z.ZodArray<z.ZodObject<{
                    title: z.ZodString;
                    url: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    url: string;
                    title: string;
                }, {
                    url: string;
                    title: string;
                }>, "many">;
            }, "strip", z.ZodTypeAny, {
                query: string;
                sources: {
                    url: string;
                    title: string;
                }[];
            }, {
                query: string;
                sources: {
                    url: string;
                    title: string;
                }[];
            }>, "many">>;
            checklist: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                text: z.ZodString;
                checked: z.ZodDefault<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                id: string;
                text: string;
                checked: boolean;
            }, {
                id: string;
                text: string;
                checked?: boolean | undefined;
            }>, "many">>;
            updatedAt: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            id: string;
            status: "未作成" | "AIの下書き" | "書き込みあり" | "完了";
            checklist: {
                id: string;
                text: string;
                checked: boolean;
            }[];
            title: string;
            goal: string;
            done: boolean;
            review: boolean;
            blocks: {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "checklist";
                content: string;
                author: "AI" | "自";
                notes: {
                    id: string;
                    type: "text" | "image" | "drawing" | "quote" | "url";
                    content: string;
                    timestamp: number;
                }[];
            }[];
            hints: {
                query: string;
                sources: {
                    url: string;
                    title: string;
                }[];
            }[];
            updatedAt: number;
        }, {
            id: string;
            status: "未作成" | "AIの下書き" | "書き込みあり" | "完了";
            title: string;
            goal: string;
            updatedAt: number;
            checklist?: {
                id: string;
                text: string;
                checked?: boolean | undefined;
            }[] | undefined;
            done?: boolean | undefined;
            review?: boolean | undefined;
            blocks?: {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "checklist";
                content: string;
                author: "AI" | "自";
                notes?: {
                    id: string;
                    type: "text" | "image" | "drawing" | "quote" | "url";
                    content: string;
                    timestamp: number;
                }[] | undefined;
            }[] | undefined;
            hints?: {
                query: string;
                sources: {
                    url: string;
                    title: string;
                }[];
            }[] | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        sections: {
            id: string;
            status: "未作成" | "AIの下書き" | "書き込みあり" | "完了";
            checklist: {
                id: string;
                text: string;
                checked: boolean;
            }[];
            title: string;
            goal: string;
            done: boolean;
            review: boolean;
            blocks: {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "checklist";
                content: string;
                author: "AI" | "自";
                notes: {
                    id: string;
                    type: "text" | "image" | "drawing" | "quote" | "url";
                    content: string;
                    timestamp: number;
                }[];
            }[];
            hints: {
                query: string;
                sources: {
                    url: string;
                    title: string;
                }[];
            }[];
            updatedAt: number;
        }[];
    }, {
        id: string;
        title: string;
        sections: {
            id: string;
            status: "未作成" | "AIの下書き" | "書き込みあり" | "完了";
            title: string;
            goal: string;
            updatedAt: number;
            checklist?: {
                id: string;
                text: string;
                checked?: boolean | undefined;
            }[] | undefined;
            done?: boolean | undefined;
            review?: boolean | undefined;
            blocks?: {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "checklist";
                content: string;
                author: "AI" | "自";
                notes?: {
                    id: string;
                    type: "text" | "image" | "drawing" | "quote" | "url";
                    content: string;
                    timestamp: number;
                }[] | undefined;
            }[] | undefined;
            hints?: {
                query: string;
                sources: {
                    url: string;
                    title: string;
                }[];
            }[] | undefined;
        }[];
    }>, "many">;
    schemaVersion: z.ZodLiteral<1>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    goal: string;
    updatedAt: number;
    context: string;
    chapters: {
        id: string;
        title: string;
        sections: {
            id: string;
            status: "未作成" | "AIの下書き" | "書き込みあり" | "完了";
            checklist: {
                id: string;
                text: string;
                checked: boolean;
            }[];
            title: string;
            goal: string;
            done: boolean;
            review: boolean;
            blocks: {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "checklist";
                content: string;
                author: "AI" | "自";
                notes: {
                    id: string;
                    type: "text" | "image" | "drawing" | "quote" | "url";
                    content: string;
                    timestamp: number;
                }[];
            }[];
            hints: {
                query: string;
                sources: {
                    url: string;
                    title: string;
                }[];
            }[];
            updatedAt: number;
        }[];
    }[];
    schemaVersion: 1;
    createdAt: number;
}, {
    id: string;
    title: string;
    goal: string;
    updatedAt: number;
    context: string;
    chapters: {
        id: string;
        title: string;
        sections: {
            id: string;
            status: "未作成" | "AIの下書き" | "書き込みあり" | "完了";
            title: string;
            goal: string;
            updatedAt: number;
            checklist?: {
                id: string;
                text: string;
                checked?: boolean | undefined;
            }[] | undefined;
            done?: boolean | undefined;
            review?: boolean | undefined;
            blocks?: {
                id: string;
                type: "text" | "image" | "drawing" | "quote" | "checklist";
                content: string;
                author: "AI" | "自";
                notes?: {
                    id: string;
                    type: "text" | "image" | "drawing" | "quote" | "url";
                    content: string;
                    timestamp: number;
                }[] | undefined;
            }[] | undefined;
            hints?: {
                query: string;
                sources: {
                    url: string;
                    title: string;
                }[];
            }[] | undefined;
        }[];
    }[];
    schemaVersion: 1;
    createdAt: number;
}>;
export type Block = z.infer<typeof BlockSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type Textbook = z.infer<typeof TextbookSchema>;
//# sourceMappingURL=types.d.ts.map