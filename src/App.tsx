/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { BookOpen, Camera, History, Loader2, Plus, Trash2, Download, CheckCircle2, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Toaster, toast } from "sonner";
import { geminiService } from "./services/geminiService";
import { pdfService } from "./services/pdfService";
import { Question, SimilarQuestion, WrongQuestionRecord } from "./types";
import ReactMarkdown from "react-markdown";

export default function App() {
  const [activeTab, setActiveTab] = useState<"ocr" | "notebook">("ocr");
  const [records, setRecords] = useState<WrongQuestionRecord[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  
  // OCR State
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<Partial<Question> | null>(null);
  const [knowledgePoint, setKnowledgePoint] = useState("");
  const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Detail View State
  const [viewingRecord, setViewingRecord] = useState<WrongQuestionRecord | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("wrong_questions");
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load records", e);
      }
    }
  }, []);

  const saveRecords = (newRecords: WrongQuestionRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem("wrong_questions", JSON.stringify(newRecords));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImage(base64);
      setIsProcessing(true);
      setOcrResult(null);
      setSimilarQuestions([]);
      setKnowledgePoint("");

      try {
        const base64Data = base64.split(",")[1];
        const result = await geminiService.performOCR(base64Data);
        setOcrResult(result);
        if (result.content) {
          const kp = await geminiService.extractKnowledgePoint(result.content);
          setKnowledgePoint(kp);
        }
        toast.success("识别成功");
      } catch (error) {
        toast.error("识别失败，请重试");
        console.error(error);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateSimilar = async () => {
    if (!ocrResult?.content || !knowledgePoint) return;
    
    setIsGenerating(true);
    try {
      const questions = await geminiService.generateSimilarQuestions(ocrResult.content, knowledgePoint);
      setSimilarQuestions(questions);
      toast.success("举一反三生成成功");
    } catch (error) {
      toast.error("生成失败，请重试");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveRecord = () => {
    if (!ocrResult?.content || !knowledgePoint || similarQuestions.length === 0) return;

    const newRecord: WrongQuestionRecord = {
      id: `record-${Date.now()}`,
      originalQuestion: {
        id: `orig-${Date.now()}`,
        content: ocrResult.content,
        options: ocrResult.options,
        userAnswer: ocrResult.userAnswer,
        standardAnswer: ocrResult.standardAnswer,
      },
      knowledgePoint,
      similarQuestions,
      createdAt: Date.now(),
    };

    saveRecords([newRecord, ...records]);
    toast.success("已保存到错题本");
    
    // Reset OCR state
    setImage(null);
    setOcrResult(null);
    setKnowledgePoint("");
    setSimilarQuestions([]);
  };

  const handleDeleteRecord = (id: string) => {
    const newRecords = records.filter(r => r.id !== id);
    saveRecords(newRecords);
    setSelectedRecordIds(selectedRecordIds.filter(sid => sid !== id));
    toast.success("已删除记录");
  };

  const handlePrint = async () => {
    if (selectedRecordIds.length === 0) {
      toast.error("请先选择要打印的错题");
      return;
    }
    const selectedRecords = records.filter(r => selectedRecordIds.includes(r.id));
    toast.info("正在生成 PDF...");
    await pdfService.generatePDF(selectedRecords);
    toast.success("PDF 已生成");
  };

  const toggleSelect = (id: string) => {
    setSelectedRecordIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRecordIds.length === records.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(records.map(r => r.id));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">全科错题通</h1>
        </div>
        {activeTab === "notebook" && records.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleSelectAll}>
              {selectedRecordIds.length === records.length ? "取消全选" : "全选"}
            </Button>
            <Button size="sm" onClick={handlePrint} disabled={selectedRecordIds.length === 0}>
              <Download className="w-4 h-4 mr-1" />
              打印 ({selectedRecordIds.length})
            </Button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === "ocr" ? (
            <motion.div
              key="ocr"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full flex flex-col p-4 gap-4 overflow-y-auto pb-24"
            >
              {/* Upload Area */}
              {!image ? (
                <Card className="border-dashed border-2 border-slate-300 bg-slate-50/50 hover:bg-slate-100 transition-colors cursor-pointer group relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="bg-white p-4 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                      <Camera className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-slate-700">点击或拖拽上传错题图片</p>
                      <p className="text-sm text-slate-500">支持 JPG, PNG, WebP</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                  <img src={image} alt="Uploaded" className="w-full max-h-64 object-contain bg-slate-100" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 rounded-full h-8 w-8"
                    onClick={() => {
                      setImage(null);
                      setOcrResult(null);
                      setKnowledgePoint("");
                      setSimilarQuestions([]);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* OCR Results */}
              {isProcessing && (
                <Card className="animate-pulse">
                  <CardContent className="py-8 flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <p className="text-sm text-slate-600 font-medium">正在识别题目内容...</p>
                  </CardContent>
                </Card>
              )}

              {ocrResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        识别结果
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">题目内容</label>
                        <Textarea
                          value={ocrResult.content}
                          onChange={(e) => setOcrResult({ ...ocrResult, content: e.target.value })}
                          className="min-h-[100px] resize-none"
                        />
                      </div>
                      
                      {ocrResult.options && ocrResult.options.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">选项</label>
                          <div className="grid grid-cols-1 gap-2">
                            {ocrResult.options.map((opt, idx) => (
                              <Input
                                key={idx}
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...(ocrResult.options || [])];
                                  newOpts[idx] = e.target.value;
                                  setOcrResult({ ...ocrResult, options: newOpts });
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">我的回答</label>
                          <Input
                            value={ocrResult.userAnswer || ""}
                            onChange={(e) => setOcrResult({ ...ocrResult, userAnswer: e.target.value })}
                            placeholder="选填"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">标准答案</label>
                          <Input
                            value={ocrResult.standardAnswer || ""}
                            onChange={(e) => setOcrResult({ ...ocrResult, standardAnswer: e.target.value })}
                            placeholder="选填"
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">核心知识点</label>
                        <div className="flex gap-2">
                          <Input
                            value={knowledgePoint}
                            onChange={(e) => setKnowledgePoint(e.target.value)}
                            placeholder="例如：一元二次方程"
                            className="flex-1"
                          />
                          <Button variant="outline" size="icon" onClick={async () => {
                            if (ocrResult.content) {
                              const kp = await geminiService.extractKnowledgePoint(ocrResult.content);
                              setKnowledgePoint(kp);
                            }
                          }}>
                            <History className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className="w-full bg-indigo-600 hover:bg-indigo-700" 
                        onClick={handleGenerateSimilar}
                        disabled={isGenerating || !ocrResult.content || !knowledgePoint}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            正在生成举一反三...
                          </>
                        ) : (
                          "生成举一反三 (3道题)"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* Similar Questions Display */}
                  {similarQuestions.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-slate-800">举一反三练习</h3>
                        <Button variant="ghost" size="sm" className="text-indigo-600" onClick={handleGenerateSimilar}>
                          重新生成
                        </Button>
                      </div>
                      {similarQuestions.map((sq, idx) => (
                        <Card key={sq.id} className="border-l-4 border-l-indigo-500">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-indigo-600">变式题 {idx + 1}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-sm leading-relaxed">{sq.content}</p>
                            {sq.options && sq.options.length > 0 && (
                              <div className="grid grid-cols-1 gap-1.5 pl-2">
                                {sq.options.map((opt, i) => (
                                  <div key={i} className="text-sm text-slate-600 flex gap-2">
                                    <span className="font-medium">{String.fromCharCode(65 + i)}.</span>
                                    <span>{opt}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="bg-slate-50 p-3 rounded-lg space-y-2 border border-slate-100">
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary" className="mt-0.5">答案</Badge>
                                <span className="text-sm font-medium">{sq.answer}</span>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">解析</p>
                                <div className="text-xs text-slate-600 prose prose-sm max-w-none">
                                  <ReactMarkdown>{sq.analysis}</ReactMarkdown>
                                </div>
                              </div>
                              <div className="space-y-1 pt-1">
                                <p className="text-xs font-bold text-red-400 uppercase tracking-tighter">易错点分析</p>
                                <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 italic">
                                  {sq.commonMistakes}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      <Button className="w-full py-6 text-lg font-bold shadow-lg" onClick={handleSaveRecord}>
                        保存整套记录到错题本
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="notebook"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full flex flex-col p-4 gap-4 overflow-y-auto pb-24"
            >
              {records.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                  <History className="w-16 h-16 opacity-20" />
                  <div className="text-center">
                    <p className="font-medium">暂无错题记录</p>
                    <p className="text-sm">快去识别第一道错题吧！</p>
                  </div>
                  <Button variant="outline" onClick={() => setActiveTab("ocr")}>
                    立即去识别
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {records.map((record) => (
                    <Card 
                      key={record.id} 
                      className={`transition-all ${selectedRecordIds.includes(record.id) ? 'ring-2 ring-indigo-500 bg-indigo-50/30' : 'hover:border-slate-300'}`}
                    >
                      <CardContent className="p-0">
                        <div className="flex items-center p-4 gap-4">
                          <Checkbox 
                            checked={selectedRecordIds.includes(record.id)}
                            onCheckedChange={() => toggleSelect(record.id)}
                            className="h-5 w-5"
                          />
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewingRecord(record)}>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="bg-white">{record.knowledgePoint}</Badge>
                              <span className="text-[10px] text-slate-400">{new Date(record.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm font-medium truncate text-slate-700">
                              {record.originalQuestion.content}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => handleDeleteRecord(record.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Record Detail Modal */}
        <AnimatePresence>
          {viewingRecord && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setViewingRecord(null)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="bg-white w-full max-w-2xl h-[90vh] sm:h-[80vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                  <div>
                    <h2 className="font-bold text-slate-800">错题详情</h2>
                    <p className="text-xs text-slate-500">{viewingRecord.knowledgePoint}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setViewingRecord(null)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-6 pb-10">
                    {/* Original Question */}
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-red-500 rounded-full" />
                        <h3 className="font-bold text-slate-700">原题回顾</h3>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                        <p className="text-sm leading-relaxed">{viewingRecord.originalQuestion.content}</p>
                        {viewingRecord.originalQuestion.options && viewingRecord.originalQuestion.options.length > 0 && (
                          <div className="grid grid-cols-1 gap-2 pl-2">
                            {viewingRecord.originalQuestion.options.map((opt, i) => (
                              <div key={i} className="text-sm text-slate-600 flex gap-2">
                                <span className="font-medium">{String.fromCharCode(65 + i)}.</span>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="bg-white p-2 rounded border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">我的回答</p>
                            <p className="text-sm font-medium">{viewingRecord.originalQuestion.userAnswer || "未填写"}</p>
                          </div>
                          <div className="bg-white p-2 rounded border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">标准答案</p>
                            <p className="text-sm font-medium text-green-600">{viewingRecord.originalQuestion.standardAnswer || "未填写"}</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <Separator />

                    {/* Similar Questions */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                        <h3 className="font-bold text-slate-700">举一反三</h3>
                      </div>
                      {viewingRecord.similarQuestions.map((sq, idx) => (
                        <div key={sq.id} className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100">
                            <span className="text-xs font-bold text-indigo-600">变式题 {idx + 1}</span>
                          </div>
                          <div className="p-4 space-y-4">
                            <p className="text-sm leading-relaxed">{sq.content}</p>
                            {sq.options && sq.options.length > 0 && (
                              <div className="grid grid-cols-1 gap-1.5 pl-2">
                                {sq.options.map((opt, i) => (
                                  <div key={i} className="text-sm text-slate-600 flex gap-2">
                                    <span className="font-medium">{String.fromCharCode(65 + i)}.</span>
                                    <span>{opt}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="bg-slate-50 p-3 rounded-lg space-y-3 border border-slate-100">
                              <div className="flex items-start gap-2">
                                <Badge variant="secondary">答案</Badge>
                                <span className="text-sm font-medium">{sq.answer}</span>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">解析</p>
                                <div className="text-xs text-slate-600 prose prose-sm max-w-none">
                                  <ReactMarkdown>{sq.analysis}</ReactMarkdown>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-red-400 uppercase">易错点分析</p>
                                <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 italic">
                                  {sq.commonMistakes}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </section>
                  </div>
                </ScrollArea>
                <div className="p-4 border-t bg-white">
                  <Button className="w-full" onClick={() => setViewingRecord(null)}>关闭详情</Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-slate-200 px-6 py-2 flex justify-around items-center fixed bottom-0 w-full z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
        <button
          onClick={() => setActiveTab("ocr")}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "ocr" ? "text-indigo-600" : "text-slate-400"}`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === "ocr" ? "bg-indigo-50" : ""}`}>
            <Camera className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">错题识别</span>
        </button>
        <button
          onClick={() => setActiveTab("notebook")}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "notebook" ? "text-indigo-600" : "text-slate-400"}`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === "notebook" ? "bg-indigo-50" : ""}`}>
            <History className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">错题本</span>
        </button>
      </nav>
    </div>
  );
}
