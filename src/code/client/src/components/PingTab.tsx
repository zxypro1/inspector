import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const PingTab = ({ onPingClick }: { onPingClick: () => void }) => {
  return (
    <TabsContent value="ping" className="grid grid-cols-2 gap-2">
      <div className="col-span-2 flex justify-center items-center">
        <Button
          onClick={onPingClick}
          className="font-bold py-6 px-12 rounded-full"
        >
          Ping Server
        </Button>
      </div>
    </TabsContent>
  );
};

export default PingTab;
