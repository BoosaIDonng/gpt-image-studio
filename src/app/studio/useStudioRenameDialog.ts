import { ref, type Ref } from "vue";
import type { Conversation, ImageAsset } from "../../types/studio";

type RenameDialogState = {
  isOpen: boolean;
  conversationId: string;
  initialTitle: string;
};

type RenameImageDialogState = {
  isOpen: boolean;
  imageId: string;
  initialName: string;
};

export function useStudioRenameDialog(ctx: {
  conversations: Ref<Conversation[]>;
  renameConversation: (id: string, title: string) => Promise<unknown>;
  imageById: (id: string) => ImageAsset | undefined;
  renameImage: (id: string, name: string) => Promise<unknown>;
  notifySuccess: (message: string) => void;
}) {
  const renameDialog = ref<RenameDialogState>({
    isOpen: false,
    conversationId: "",
    initialTitle: "",
  });

  const renameImageDialog = ref<RenameImageDialogState>({
    isOpen: false,
    imageId: "",
    initialName: "",
  });

  async function renameConversation(id: string) {
    const conversation = ctx.conversations.value.find((item) => item.id === id);
    if (!conversation) return;
    renameDialog.value = {
      isOpen: true,
      conversationId: id,
      initialTitle: conversation.title,
    };
  }

  function cancelRenameConversation() {
    renameDialog.value = {
      isOpen: false,
      conversationId: "",
      initialTitle: "",
    };
  }

  async function confirmRenameConversation(nextTitle: string) {
    const conversationId = renameDialog.value.conversationId;
    const previousTitle = renameDialog.value.initialTitle;
    if (!conversationId) return;

    cancelRenameConversation();
    if (nextTitle === previousTitle) return;
    await ctx.renameConversation(conversationId, nextTitle);
    ctx.notifySuccess("会话已重命名。");
  }

  function requestRenameImage(id: string) {
    const image = ctx.imageById(id);
    if (!image) return;
    renameImageDialog.value = {
      isOpen: true,
      imageId: id,
      initialName: image.name,
    };
  }

  function cancelRenameImage() {
    renameImageDialog.value = {
      isOpen: false,
      imageId: "",
      initialName: "",
    };
  }

  async function confirmRenameImage(nextName: string) {
    const imageId = renameImageDialog.value.imageId;
    const previousName = renameImageDialog.value.initialName;
    if (!imageId) return;

    cancelRenameImage();
    if (nextName === previousName) return;
    await ctx.renameImage(imageId, nextName);
    ctx.notifySuccess("图片已重命名。");
  }

  return {
    renameDialog,
    renameImageDialog,
    renameConversation,
    cancelRenameConversation,
    confirmRenameConversation,
    requestRenameImage,
    cancelRenameImage,
    confirmRenameImage,
  };
}
